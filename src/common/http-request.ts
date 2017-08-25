const http = require('http');

export class HttpRequest {
    static makeRequest(options,data?){
        return new Promise((accept,reject)=>{
            try {
                let req = http.request(options, (response) => {
                    let data = '';
                    response.on('data', (chunk) =>{
                        data += chunk;
                    });
                    response.on('end', () =>{
                        let content_type = response.headers['content-type'];
                        if(content_type.indexOf('json')>-1){
                            try{
                                data = JSON.parse(data)
                            }catch (e){}
                        }
                        let res = {
                            headers         : response.headers,
                            status_code     : response.statusCode,
                            status_message  : response.statusMessage,
                            data            : data
                        };
                        if(res.status_code<400){
                            accept(res);
                        }else {
                            reject(res);
                        }
                    });
                });
                if(data){
                    try{
                        data = JSON.stringify(data)
                    }catch (e){}
                    req.write(data);
                }
                req.end();
            }catch (e){
                reject(e)
            }
        })
    }

    static get(options){
        return this.makeRequest(Object.assign(options,{
            method : "GET"
        }))
    }
}