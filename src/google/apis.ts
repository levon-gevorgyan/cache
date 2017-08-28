import {cached} from "@ecmal/runtime/decorators";


export class GoogleApis{

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