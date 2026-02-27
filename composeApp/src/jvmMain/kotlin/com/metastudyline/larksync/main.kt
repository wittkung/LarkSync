package com.metastudyline.larksync

import androidx.compose.desktop.ui.tooling.preview.Preview
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.utils.io.core.*
import kotlinx.coroutines.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import kotlinx.serialization.encodeToString

@Serializable
data class FeishuConfig(
    val appId: String = "",
    val appSecret: String = "",
    val spaceId: String = "",
    val saveDir: String = "./Feishu_Export",
    val isIncremental: Boolean = true,
    val keepStructure: Boolean = true,
    val namingStrategy: String = "仅标题"
)

@Serializable data class AuthRequest(val app_id: String, val app_secret: String)
@Serializable data class AuthResponse(val code: Int, val msg: String, val tenant_access_token: String = "")

@Serializable data class NodeItem(val node_token: String, val obj_token: String, val obj_type: String, val title: String, val has_child: Boolean)
@Serializable data class NodeData(val items: List<NodeItem> = emptyList(), val has_more: Boolean = false, val page_token: String = "")
@Serializable data class NodeResponse(val code: Int, val msg: String, val data: NodeData? = null)

@Serializable data class ExportRequest(val file_extension: String, val token: String, val type: String)
@Serializable data class ExportTaskData(val ticket: String)
@Serializable data class ExportTaskResponse(val code: Int, val msg: String, val data: ExportTaskData? = null)

@Serializable data class QueryResult(val job_status: Int, val file_token: String = "")
@Serializable data class QueryData(val result: QueryResult? = null)
@Serializable data class QueryResponse(val code: Int, val msg: String, val data: QueryData? = null)

@Serializable data class MetaRequestItem(val token: String, val type: String)
@Serializable data class MetaRequest(val request_docs: List<MetaRequestItem>)
@Serializable data class MetaItem(val token: String, val edit_time: String = "0")
@Serializable data class MetaData(val metas: List<MetaItem> = emptyList())
@Serializable data class MetaResponse(val code: Int, val data: MetaData? = null)

class FeishuExportViewModel {
    var appId by mutableStateOf("")
    var appSecret by mutableStateOf("")
    var spaceId by mutableStateOf("")
    var saveDir by mutableStateOf("./Feishu_Export")
    var isIncremental by mutableStateOf(true)
    var keepStructure by mutableStateOf(true)
    var namingStrategy by mutableStateOf("仅标题")
    var isRunning by mutableStateOf(false)
    var logText by mutableStateOf("准备就绪...\n")
        private set

    private val configFile = File(System.getProperty("user.dir"), "feishu_config.json")
    private val stateFile = File(System.getProperty("user.dir"), "sync_state.json")
    private val jsonParser = Json { ignoreUnknownKeys = true; isLenient = true }
    
    private var syncState = mutableMapOf<String, String>()

    init {
        loadConfig()
        loadSyncState()
    }

    fun appendLog(message: String) {
        logText += "$message\n"
    }

    private fun loadConfig() {
        if (configFile.exists()) {
            try {
                val config = jsonParser.decodeFromString<FeishuConfig>(configFile.readText())
                appId = config.appId
                appSecret = config.appSecret
                spaceId = config.spaceId
                saveDir = config.saveDir
                isIncremental = config.isIncremental
                keepStructure = config.keepStructure
                namingStrategy = config.namingStrategy
            } catch (e: Exception) {
                appendLog("解析配置失败: ${e.message}")
            }
        }
    }

    private fun saveConfig() {
        try {
            val config = FeishuConfig(appId, appSecret, spaceId, saveDir, isIncremental, keepStructure, namingStrategy)
            configFile.writeText(jsonParser.encodeToString(config))
        } catch (e: Exception) {
            appendLog("保存配置失败: ${e.message}")
        }
    }

    private fun loadSyncState() {
        if (stateFile.exists()) {
            try {
                syncState = jsonParser.decodeFromString(stateFile.readText())
            } catch (e: Exception) {
                syncState = mutableMapOf()
            }
        }
    }

    private fun saveSyncState() {
        try {
            stateFile.writeText(jsonParser.encodeToString(syncState))
        } catch (e: Exception) {
            appendLog("保存同步状态失败: ${e.message}")
        }
    }

    suspend fun startExport() {
        isRunning = true
        logText = ""
        saveConfig()
        appendLog("🚀 开始初始化导出任务...")
        
        val client = HttpClient(CIO) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true })
            }
            engine {
                requestTimeout = 60000
            }
        }

        withContext(Dispatchers.IO) {
            try {
                appendLog("正在连接飞书开放平台进行鉴权...")
                val authRes: AuthResponse = client.post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal") {
                    contentType(ContentType.Application.Json)
                    setBody(AuthRequest(appId, appSecret))
                }.body()

                if (authRes.code != 0) {
                    appendLog("❌ 鉴权失败: ${authRes.msg}")
                    return@withContext
                }
                val token = authRes.tenant_access_token
                appendLog("✅ 鉴权成功。")

                appendLog("正在扫描知识空间 (Space ID: $spaceId) ...")
                val allNodes = mutableListOf<Pair<NodeItem, String>>()
                
                suspend fun fetchNodes(parentToken: String, currentPath: String) {
                    var hasMore = true
                    var pageToken = ""
                    while (hasMore && isRunning) {
                        val url = "https://open.feishu.cn/open-apis/wiki/v2/spaces/$spaceId/nodes"
                        val nodeRes: NodeResponse = client.get(url) {
                            header("Authorization", "Bearer $token")
                            parameter("page_size", 50)
                            if (parentToken.isNotEmpty()) parameter("parent_node_token", parentToken)
                            if (pageToken.isNotEmpty()) parameter("page_token", pageToken)
                        }.body()

                        if (nodeRes.code != 0) {
                            appendLog("❌ 获取节点失败: ${nodeRes.msg}")
                            break
                        }

                        val items = nodeRes.data?.items ?: emptyList()
                        for (item in items) {
                            val safeTitle = item.title.replace("/", "_").replace("\\", "_")
                            val path = if (keepStructure) {
                                if (currentPath.isEmpty()) safeTitle else "$currentPath/$safeTitle"
                            } else ""
                            
                            allNodes.add(Pair(item, path))
                            if (item.has_child) {
                                fetchNodes(item.node_token, path)
                            }
                        }
                        hasMore = nodeRes.data?.has_more == true
                        pageToken = nodeRes.data?.page_token ?: ""
                    }
                }

                fetchNodes("", "")
                appendLog("共发现 ${allNodes.size} 个云文档节点。")

                val metaDict = mutableMapOf<String, String>()
                if (isIncremental) {
                    appendLog("正在拉取文档元数据...")
                    val requestDocs = allNodes.filter { it.first.obj_type in listOf("doc", "docx") }
                        .map { MetaRequestItem(it.first.obj_token, it.first.obj_type) }
                    
                    val chunked = requestDocs.chunked(200)
                    for (chunk in chunked) {
                        if (!isRunning) break
                        val metaRes: MetaResponse = client.post("https://open.feishu.cn/open-apis/drive/v1/metas/batch_query") {
                            header("Authorization", "Bearer $token")
                            contentType(ContentType.Application.Json)
                            setBody(MetaRequest(chunk))
                        }.body()
                        
                        if (metaRes.code == 0) {
                            metaRes.data?.metas?.forEach {
                                metaDict[it.token] = it.edit_time
                            }
                        }
                    }
                }

                var exportedCount = 0
                var skippedCount = 0

                for (nodePair in allNodes) {
                    if (!isRunning) break
                    val item = nodePair.first
                    val nodePath = nodePair.second
                    
                    if (item.obj_type !in listOf("doc", "docx")) continue

                    val safeTitle = item.title.replace("/", "_").replace("\\", "_")
                    
                    if (isIncremental) {
                        val onlineTime = metaDict[item.obj_token] ?: "0"
                        val localTime = syncState[item.obj_token] ?: "0"
                        if (onlineTime != "0" && onlineTime == localTime) {
                            skippedCount++
                            appendLog("⏭️ [跳过] $safeTitle")
                            continue
                        }
                    }

                    val fileName = if (namingStrategy == "标题 + Token标识") {
                        "${safeTitle}_${item.obj_token.takeLast(6)}.docx"
                    } else {
                        "$safeTitle.docx"
                    }

                    val fileDir = if (keepStructure && nodePath.contains("/")) {
                        File(saveDir, nodePath.substringBeforeLast("/"))
                    } else {
                        File(saveDir)
                    }
                    
                    fileDir.mkdirs()
                    val saveFile = File(fileDir, fileName)

                    appendLog("⬇️ [导出中] $safeTitle ...")
                    
                    val taskRes: ExportTaskResponse = client.post("https://open.feishu.cn/open-apis/drive/v1/export_tasks") {
                        header("Authorization", "Bearer $token")
                        contentType(ContentType.Application.Json)
                        setBody(ExportRequest("docx", item.obj_token, item.obj_type))
                    }.body()

                    if (taskRes.code != 0) {
                        appendLog("❌ 创建任务失败: ${taskRes.msg}")
                        continue
                    }
                    
                    val ticket = taskRes.data?.ticket ?: continue
                    var fileToken = ""
                    
                    for (i in 1..20) {
                        if (!isRunning) break
                        delay(2000)
                        val qRes: QueryResponse = client.get("https://open.feishu.cn/open-apis/drive/v1/export_tasks/$ticket?token=${item.obj_token}") {
                            header("Authorization", "Bearer $token")
                        }.body()
                        
                        if (qRes.code == 0 && qRes.data?.result?.job_status == 0) {
                            fileToken = qRes.data.result.file_token
                            break
                        }
                    }

                    if (fileToken.isNotEmpty()) {
                        val downloadRes: HttpResponse = client.get("https://open.feishu.cn/open-apis/drive/v1/export_tasks/file/$fileToken/download") {
                            header("Authorization", "Bearer $token")
                        }
                        if (downloadRes.status == HttpStatusCode.OK) {
                            val bytes = downloadRes.body<ByteArray>()
                            saveFile.writeBytes(bytes)
                            appendLog("✅ 成功保存在: ${saveFile.absolutePath}")
                            exportedCount++
                            
                            if (isIncremental) {
                                metaDict[item.obj_token]?.let {
                                    syncState[item.obj_token] = it
                                    saveSyncState()
                                }
                            }
                        } else {
                            appendLog("❌ 下载失败: HTTP ${downloadRes.status}")
                        }
                    } else {
                        appendLog("❌ 任务超时。")
                    }
                }

                if (isRunning) {
                    appendLog("🎉 任务完成！导出 $exportedCount 个文档，跳过 $skippedCount 个。")
                }

            } catch (e: Exception) {
                appendLog("❌ 发生异常: ${e.message}")
            } finally {
                client.close()
                isRunning = false
            }
        }
    }

    fun stopExport() {
        isRunning = false
        appendLog("🛑 正在停止任务...")
    }
}

@Composable
@Preview
fun FeishuExportApp(viewModel: FeishuExportViewModel) {
    MaterialTheme {
        Scaffold(
            topBar = {
                @OptIn(ExperimentalMaterial3Api::class)
                TopAppBar(
                    title = { Text("飞书同步", fontWeight = FontWeight.Bold) },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("API 凭证配置", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                        OutlinedTextField(
                            value = viewModel.appId,
                            onValueChange = { viewModel.appId = it },
                            label = { Text("App ID") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = viewModel.appSecret,
                            onValueChange = { viewModel.appSecret = it },
                            label = { Text("App Secret") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = viewModel.spaceId,
                            onValueChange = { viewModel.spaceId = it },
                            label = { Text("Space ID") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                    }
                }

                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("导出偏好设置", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                        OutlinedTextField(
                            value = viewModel.saveDir,
                            onValueChange = { viewModel.saveDir = it },
                            label = { Text("本地保存路径") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = viewModel.isIncremental,
                                onCheckedChange = { viewModel.isIncremental = it }
                            )
                            Text("开启增量导出")
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = viewModel.keepStructure,
                                onCheckedChange = { viewModel.keepStructure = it }
                            )
                            Text("保留知识库目录结构")
                        }
                    }
                }

                val coroutineScope = rememberCoroutineScope()
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    if (viewModel.isRunning) {
                        Button(
                            onClick = { viewModel.stopExport() },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                        ) {
                            Text("停止同步")
                        }
                    } else {
                        Button(
                            onClick = { coroutineScope.launch { viewModel.startExport() } }
                        ) {
                            Text("🚀 开始同步")
                        }
                    }
                }

                OutlinedTextField(
                    value = viewModel.logText,
                    onValueChange = {},
                    label = { Text("运行日志") },
                    modifier = Modifier.fillMaxWidth().height(200.dp),
                    readOnly = true,
                    textStyle = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

fun main() = application {
    val viewModel = remember { FeishuExportViewModel() }
    Window(
        onCloseRequest = ::exitApplication,
        title = "Feishu Sync App",
    ) {
        FeishuExportApp(viewModel)
    }
}