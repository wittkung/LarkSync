const axios = require('axios');

async function testFeishu() {
    try {
        const response = await axios.post('https://open.feishu.cn/open-apis/drive/v1/metas/batch_query', {
            request_docs: [
                {
                    docs_token: "test",
                    docs_type: "doc"
                }
            ]
        }, {
            headers: {
                Authorization: "Bearer t-abc"
            }
        });
        console.log(response.data);
    } catch (e) {
        if (e.response) {
            console.error("DATA:", JSON.stringify(e.response.data));
        } else {
            console.error(e.message);
        }
    }
}
testFeishu();
