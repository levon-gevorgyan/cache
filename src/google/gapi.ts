import {cached} from "@ecmal/runtime/decorators";

export class GoogleApi{

    @cached
    public get google_apis(){
        return require('googleapis');
    }

    public auth_client:any;


    public authorize() {
        return new Promise((accept,reject)=>{
            this.google_apis.auth.getApplicationDefault((err, authClient)=> {
                if (err) {
                    console.log('authentication failed: ', err);
                    reject(err)
                }
                if (authClient.createScopedRequired && authClient.createScopedRequired()) {
                    let scopes = ['https://www.googleapis.com/auth/cloud-platform'];
                    authClient = authClient.createScoped(scopes);
                }
                accept(this.auth_client = authClient);
            });
        })
    }
}

export class GoogleComputeApi{
    public api:GoogleApi;

    @cached
    public get compute(){
        return this.api.google_apis.compute('v1');
    }

    public get auth_client(){
        return this.api.auth_client;
    }

    constructor(api:GoogleApi){
        this.api = api;
    }

    private request(data={}){
        return Object.assign({
            project : 'mamble-poc',
            auth    : this.auth_client
        },data)
    }

    public getProjectMetadata(){
        return new Promise((accept,reject)=>{
            this.compute.projects.get(this.request(), (err, response) =>{
                if (err) {
                    console.error(err);
                    reject(err)
                }
                //console.log(JSON.stringify(response, null, 2));
                accept(response.commonInstanceMetadata);
            });
        })
    }
    public setProjectMetadata(data){
        return new Promise((accept,reject)=>{
            this.compute.projects.setCommonInstanceMetadata(this.request({
                resource : Object.assign({
                    kind : "compute#metadata"
                },data)
            }), (err, response) =>{
                if (err) {
                    console.error(err);
                    reject(err)
                }
                //console.log(JSON.stringify(response, null, 2));
                accept(response);
            });
        })
    }

    public updateMetadata(data,remove_keys?:string[]){
        let retry = 3;
        let update = ()=>{
            return this.getProjectMetadata().then((r:any)=>{
                let toJsonString = (value)=>{
                    try {
                        if(typeof value == "object"){
                            return JSON.stringify(value);
                        }
                    }catch (e){}
                    return value;
                };
                let items = (r.items || []).reduce((p,c)=>{
                    if(data[c.key]){
                        if(typeof data[c.key] == "object"){
                            let value;
                            try{
                                value = JSON.parse(c.value)
                            }catch (e){
                                value = c.valid
                            }
                            if(typeof value == "object"){
                                let item = data[c.key] = Object.assign(JSON.parse(c.value),data[c.key]);
                                if(remove_keys && remove_keys.length){
                                    remove_keys.forEach(k=> {
                                        let keys = k.split('.');
                                        let key = keys.shift();
                                        //console.info(key,keys)
                                        if(key == c.key){
                                            keys.reduce((p,c,i)=>{
                                                let field = p[c];
                                                //console.info('Field',field)
                                                if(field != void 0){
                                                    if(i < keys.length-1){
                                                        if(typeof field == 'object'){
                                                            return field;
                                                        }
                                                    }else {
                                                        delete p[c]
                                                    }

                                                }

                                                return void 0
                                            },item)
                                        }
                                    })
                                }
                                console.info('item',c.key,JSON.stringify({
                                    old : c.value,
                                    new : item
                                },null,2))
                            }
                        }
                        p.push({
                            key   : c.key,
                            value : toJsonString(data[c.key])
                        });
                        delete  data[c.key];
                    }else {
                        p.push(c)
                    }
                    return p;
                },[]).concat(Object.keys(data).map(k=>{
                    return {
                        key     : k,
                        value   : toJsonString(data[k])
                    }
                }));
                return this.setProjectMetadata({
                    fingerprint : r.fingerprint,
                    items : items
                })

            }).catch(e=>{
                retry--;
                if(retry>0){
                    return update();
                }
                return Promise.reject({
                    message : 'set failed',
                    data    : data,
                    error   : e.stack || e
                })
            })
        };
        return update();
    }

    public deleteMetadataItem(keys:any[]){
        if(!Array.isArray(keys)){
            keys = [keys]
        }
        return this.getProjectMetadata().then((r:any)=>{
            let metadata = r.commonInstanceMetadata;
            return this.setProjectMetadata({
                fingerprint : metadata.fingerprint,
                items       : metadata.items.filter(i=>keys.indexOf(i.key) < 0)
            })

        }).catch(e=>{
            console.error('UPDATE ERROR',e)
        })
    }
}