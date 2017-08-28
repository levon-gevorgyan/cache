import {cached} from "@ecmal/runtime/decorators";
import {GoogleApis} from "../google/apis";
import app from "../app"
import {GoogleComputeApi} from "../google/compute-api";
import {GoogleAppEngineApi} from "../google/app-engine-api";


export class GoogleService {

    @cached
    public get network_config(){
        return Object.create(null);
    }

    @cached
    private get app(){
        return app;
    }

    @cached
    public get gapi(){
        return new GoogleApis();
    }
    @cached
    public get compute(){
        return new GoogleComputeApi(this.gapi);
    }
    @cached
    public get app_engine(){
        return new GoogleAppEngineApi(this.gapi);
    }

    public async init(){
        await this.gapi.authorize();
    }

    public async start(){
        await this.init();
        this.startPolling();
    }

    public async startPolling(){
        let doPoll = (r?)=>{
            //console.info('POLLING',JSON.stringify(d))
            //console.info('POLLING',JSON.stringify(r,null,2))
            if(r){
                let config = r.filter(i=>{
                    let add = !this.network_config[i.host];
                    if(add){
                        this.network_config[i.host] = i;
                    }
                    return add;
                });
                if(config.length){
                    this.app.onNetworkConfigUpdate(config);
                }
            }
            setTimeout(()=>{
                this.startPolling();
            },5000)
        };
        await this.updateNetworkConfig().then(r=>doPoll(r),e=>doPoll())
    }

    public updateNetworkConfig(){
        return this.app_engine.listInstances().then((res:any)=>{
            let instances = res && res.instances;
            if(instances){
                return instances.map(i=>{
                    return {
                        host : i.id,
                        port : this.app.process.env.CACHE_PORT
                    }
                });
            }
        }).catch(e=>{
            console.error(e);
            return Promise.reject(null);
        })

    }
}