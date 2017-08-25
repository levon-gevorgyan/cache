import {cached, signal, Signal} from "@ecmal/runtime/decorators";
import {GoogleApi, GoogleComputeApi} from "../google/gapi";
import app from "../app"


export class GoogleService {

    static toItems(items){
        return (items || []).reduce((p,c)=>{
            p[c.key] = c.value;
            return p;
        },{})
    }

    public metadata:any;

    @cached
    private get app(){
        return app;
    }
    @cached
    private get instance_key(){
        return app.instance_key;
    }
    @cached
    public get gapi(){
        return new GoogleApi();
    }
    @cached
    public get compute(){
        return new GoogleComputeApi(this.gapi);
    }

    @signal
    public onMetadataUpdate:Signal<Function>;


    public async init(){
        await this.gapi.authorize();
    }

    public startPolling(){
        let doPoll = (r?)=>{
            //console.info('POLLING',JSON.stringify(d))
            //console.info('POLLING',JSON.stringify(r,null,2))
            if(!this.metadata){
                this.metadata = {};
            }
            if(r){
                if(this.metadata.fingerprint != r.fingerprint){
                    let old_instances = JSON.parse(GoogleService.toItems(this.metadata.items)[this.instance_key] || "{}");
                    let new_instances = JSON.parse(GoogleService.toItems(r.items)[this.instance_key] || "{}");
                    let updates = Object.keys(new_instances).filter(k=>!old_instances[k]).reduce((p,c)=>{
                        p[c] =  new_instances[c];
                        return p;
                    },{});
                    //console.info('UPDATE',updates,old_instances,new_instances)
                    if(Object.keys(updates).length){
                        console.info('CONFIG UPDATED',updates)
                        this.onMetadataUpdate(updates)
                    }
                    this.metadata = r;
                }
            }
            setTimeout(()=>{
                this.startPolling();
            },5000)
        };
        this.compute.getProjectMetadata().then(r=>doPoll(r),e=>doPoll())
    }
}