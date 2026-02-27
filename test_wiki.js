const axios = require('axios');

async function testFeishuAuth() {
    try {
        const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            app_id: "cli_a72c1143c6b8d00b", // I don't know the exact app_id the user is using.
            app_secret: "hidden"
        });
        console.log(response.data);
    } catch (e) {
        console.error(e.message);
    }
}
testFeishuAuth(); // I can't run this without the keys.
