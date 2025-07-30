(function(w,O){typeof exports=="object"&&typeof module<"u"?O(exports,require("nf.Common"),require("tippy.js")):typeof define=="function"&&define.amd?define(["exports","nf.Common","tippy.js"],O):(w=typeof globalThis<"u"?globalThis:w||self,O(w.nifiCuiossUI={},w.nfCommon,w.tippy))})(this,function(w,O,Ge){"use strict";function Ye(t){const e=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(t){for(const s in t)if(s!=="default"){const i=Object.getOwnPropertyDescriptor(t,s);Object.defineProperty(e,s,i.get?i:{enumerable:!0,get:()=>t[s]})}}return e.default=t,Object.freeze(e)}const h=Ye(O),S={DEBUG:0,INFO:1,WARN:2,ERROR:3,FATAL:4},Xe=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"||window.location.hostname.startsWith("192.168.")||window.location.hostname.endsWith(".local")||window.location.search.includes("debug=true")||localStorage.getItem("nifi-debug")==="true"?S.DEBUG:S.WARN;class B{constructor(e="NiFi-UI",s=Xe){this.component=e,this.logLevel=s,this.startTime=Date.now()}_getTimestamp(){const e=new Date,s=e.getTime()-this.startTime;return`[${e.toISOString()}] (+${s}ms)`}_formatMessage(e,s,...i){return[`${this._getTimestamp()} [${e}] ${this.component}:`,s,...i]}_shouldLog(e){return e>=this.logLevel}debug(e,...s){this._shouldLog(S.DEBUG)&&console.debug(...this._formatMessage("DEBUG",e,...s))}info(e,...s){this._shouldLog(S.INFO)&&console.info(...this._formatMessage("INFO",e,...s))}warn(e,...s){this._shouldLog(S.WARN)&&console.warn(...this._formatMessage("WARN",e,...s))}error(e,...s){this._shouldLog(S.ERROR)&&console.error(...this._formatMessage("ERROR",e,...s))}fatal(e,...s){this._shouldLog(S.FATAL)&&console.error(...this._formatMessage("FATAL",e,...s))}child(e){return new B(`${this.component}:${e}`,this.logLevel)}setLogLevel(e){this.logLevel=e}time(e){const s=performance.now();return this.debug(`Starting operation: ${e}`),()=>{const i=performance.now()-s;this.debug(`Operation completed: ${e} (${i.toFixed(2)}ms)`)}}}const N=new B("NiFi-UI"),z=t=>new B(t);typeof window<"u"&&(window.nifiDebug={enable:()=>{localStorage.setItem("nifi-debug","true"),N.setLogLevel(S.DEBUG),N.info("Debug logging enabled")},disable:()=>{localStorage.removeItem("nifi-debug"),N.setLogLevel(S.WARN),N.info("Debug logging disabled")},setLevel:t=>{N.setLogLevel(t),N.info(`Log level set to: ${Object.keys(S)[t]}`)}});const Ze=t=>t.map(e=>typeof e=="string"?e:e.msg||"Error detail missing").join(", "),de=t=>t?typeof t.message=="string"?t.message:Array.isArray(t.errors)&&t.errors.length>0?Ze(t.errors):null:null,Qe=t=>{if(!t)return null;try{const e=JSON.parse(t),s=de(e);return s!==null?s:t}catch(e){return console.debug("Failed to parse responseText as JSON:",e),t}},Y=(t,e)=>{if(t==null)return e["processor.jwt.unknownError"]||"Unknown error";const s=String(t),i=s.trim(),n=s.toLowerCase();return i===""||n==="null"||n==="undefined"?e["processor.jwt.unknownError"]||"Unknown error":t},et=(t,e)=>{if(!t)return e["processor.jwt.unknownError"]||"Unknown error";const s=de(t.responseJSON);if(s)return Y(s,e);const i=Qe(t.responseText);if(i)return Y(i,e);const n=t.statusText||t.message;return Y(n,e)},C=(t,e,s,i="processor.jwt.validationError",n={})=>{const{type:o="error",closable:r=!1,autoHide:a=!1}=n,c=et(e,s),d=s[i]||"Error",v=`
        <div class="error-message ${tt(o)} ${r?"closable":""}">
            <div class="error-content">
                <strong>${d}:</strong> ${c}
            </div>
            ${r?'<button class="close-error" aria-label="Close error">&times;</button>':""}
        </div>
    `,y=t[0]||t;if(y.innerHTML=v,r){const p=y.querySelector(".close-error");p&&p.addEventListener("click",()=>{const k=y.querySelector(".error-message");k&&(k.style.transition="opacity 0.3s",k.style.opacity="0",setTimeout(()=>k.remove(),300))})}a&&setTimeout(()=>{const p=y.querySelector(".error-message");p&&(p.style.transition="opacity 0.3s",p.style.opacity="0",setTimeout(()=>p.remove(),300))},5e3)},X=(t,e,s={})=>{const{autoHide:i=!0}=s,o=`
        <div class="success-message ${i?"auto-dismiss":""}">
            <div class="success-content">${e}</div>
        </div>
    `,r=t[0]||t;r.innerHTML=o,i&&setTimeout(()=>{const a=r.querySelector(".success-message");a&&a.remove()},5e3)},tt=t=>{switch(t){case"validation":return"validation-error";case"network":return"network-error";case"server":return"server-error";default:return""}},ue=t=>{const{title:e,message:s,confirmText:i="Delete",cancelText:n="Cancel",type:o="danger",onConfirm:r,onCancel:a}=t;return new Promise(c=>{document.querySelectorAll(".confirmation-dialog").forEach(u=>u.remove());const d=st(e,s,i,n,o),m=document.createElement("div");m.innerHTML=d;const I=m.firstElementChild;document.body.appendChild(I),it(I,c,r,a),requestAnimationFrame(()=>{I.classList.add("show");const u=I.querySelector(".cancel-button");u&&u.focus()})})},J=t=>{const e=document.createElement("div");return e.textContent=t,e.innerHTML},st=(t,e,s,i,n)=>{const o=ot(n),r=rt(n);return`
        <div class="confirmation-dialog ${o}">
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <div class="dialog-header">
                    <div class="dialog-icon">${r}</div>
                    <h3 class="dialog-title">${J(t)}</h3>
                </div>
                <div class="dialog-body">
                    <p class="dialog-message">${J(e)}</p>
                </div>
                <div class="dialog-footer">
                    <button class="cancel-button">${J(i)}</button>
                    <button class="confirm-button ${n}-button">
                        ${J(s)}
                    </button>
                </div>
            </div>
        </div>
    `},it=(t,e,s,i)=>{const n=()=>{pe(t),s&&s(),e(!0)},o=()=>{pe(t),i&&i(),e(!1)},r=t.querySelector(".confirm-button"),a=t.querySelector(".cancel-button");r&&r.addEventListener("click",n),a&&a.addEventListener("click",o);const c=t.querySelector(".dialog-overlay");c&&c.addEventListener("click",o),t.addEventListener("keydown",d=>{d.key==="Escape"?(d.preventDefault(),o()):d.key==="Enter"&&d.target.classList.contains("confirm-button")&&(d.preventDefault(),n())}),nt(t)},pe=t=>{t.classList.remove("show"),setTimeout(()=>{t.remove()},300)},nt=t=>{const e=t.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),s=e[0],i=e[e.length-1];t.addEventListener("keydown",n=>{n.key==="Tab"&&(n.shiftKey?document.activeElement===s&&(n.preventDefault(),i&&i.focus()):document.activeElement===i&&(n.preventDefault(),s&&s.focus()))})},ot=t=>{switch(t){case"danger":return"dialog-danger";case"warning":return"dialog-warning";case"info":return"dialog-info";default:return"dialog-danger"}},rt=t=>{switch(t){case"danger":return"🗑️";case"warning":return"⚠️";case"info":return"ℹ️";default:return"🗑️"}},at=(t,e)=>ue({title:"Remove Issuer Configuration",message:`Are you sure you want to remove the issuer "${t}"? This action cannot be undone.`,confirmText:"Remove",cancelText:"Cancel",type:"danger",onConfirm:e}),ct=t=>ue({title:"Clear Form Data",message:"Are you sure you want to clear all form data? Any unsaved changes will be lost.",confirmText:"Clear",cancelText:"Cancel",type:"warning",onConfirm:t}),W={BASE_URL:"../nifi-api/processors/jwt",NIFI_BASE_URL:"../nifi-api/processors",ENDPOINTS:{VALIDATE_JWKS_URL:"/validate-jwks-url",VERIFY_TOKEN:"/verify-token",GET_ISSUER_CONFIG:"/issuer-config",SET_ISSUER_CONFIG:"/issuer-config",JWKS_VALIDATE_URL:"../nifi-api/processors/jwks/validate-url",JWT_VERIFY_TOKEN:"../nifi-api/processors/jwt/verify-token"},TIMEOUTS:{DEFAULT:5e3,LONG_OPERATION:1e4,SHORT_OPERATION:2e3,DIALOG_DELAY:500,UI_FALLBACK_TIMEOUT:3e3,TOKEN_CACHE_DURATION:36e5,ERROR_DISPLAY_TIMEOUT:5e3}},f={CLASSES:{SUCCESS_MESSAGE:"success-message",ERROR_MESSAGE:"error-message",WARNING_MESSAGE:"warning-message",LOADING:"loading",HIDDEN:"hidden",DISABLED:"disabled",INVALID:"invalid",VALID:"valid",PROPERTY_LABEL:"property-label",HELP_TOOLTIP:"help-tooltip",PROCESSOR_DIALOG:"processor-dialog",PROCESSOR_TYPE:"processor-type",JWT_VALIDATOR_TITLE:"jwt-validator-title",FA:"fa",FA_QUESTION_CIRCLE:"fa-question-circle"},SELECTORS:{ERROR_CONTAINER:".error-container",SUCCESS_CONTAINER:".success-container",LOADING_INDICATOR:".loading-indicator",FORM_GROUP:".form-group",INPUT_FIELD:".input-field",BUTTON:".button",TOOLTIP:".tooltip",PROPERTY_LABEL:".property-label",HELP_TOOLTIP:".help-tooltip",PROCESSOR_DIALOG:".processor-dialog",PROCESSOR_TYPE:".processor-type",JWT_VALIDATOR_TITLE:".jwt-validator-title"},IDS:{LOADING_INDICATOR:"loading-indicator",JWT_VALIDATOR_TABS:"jwt-validator-tabs"},ISSUER_CONFIG:{CONTAINER:"issuer-config-editor",ISSUERS_CONTAINER:"issuers-container",GLOBAL_ERROR_MESSAGES:"global-error-messages",ADD_ISSUER_BUTTON:"add-issuer-button",REMOVE_ISSUER_BUTTON:"remove-issuer-button",SAVE_ISSUER_BUTTON:"save-issuer-button",ISSUER_FORM:"issuer-form",FORM_HEADER:"form-header",FORM_FIELDS:"form-fields"},TOKEN_VERIFIER:{CONTAINER:"token-verification-container",INPUT_SECTION:"token-input-section",RESULTS_SECTION:"token-results-section",TOKEN_INPUT:"token-input",VERIFY_BUTTON:"verify-token-button",RESULTS_CONTENT:"token-results-content",TOKEN_ERROR:"token-error",TOKEN_LOADING:"token-loading",TOKEN_VALID:"token-valid",TOKEN_INVALID:"token-invalid",TOKEN_DETAILS:"token-details",TOKEN_ERROR_DETAILS:"token-error-details",TOKEN_ERROR_MESSAGE:"token-error-message",TOKEN_ERROR_CATEGORY:"token-error-category",TOKEN_RAW_CLAIMS:"token-raw-claims",TOKEN_CLAIMS_TABLE:"token-claims-table",TOKEN_INSTRUCTIONS:"token-instructions"},JWKS_VALIDATOR:{CONTAINER:"jwks-verification-container",BUTTON_WRAPPER:"jwks-button-wrapper",VERIFY_BUTTON:"verify-jwks-button",VERIFICATION_RESULT:"verification-result"}},M={ISSUER_CONFIG_EDITOR:{DEFAULT_ISSUER_NAME:"sample-issuer",SAMPLE_ISSUER_URL:"https://sample-issuer.example.com",SAMPLE_JWKS_URL:"https://sample-issuer.example.com/.well-known/jwks.json",SAMPLE_AUDIENCE:"sample-audience",SAMPLE_CLIENT_ID:"sample-client"}},x={COMPONENT_TABS:{ISSUER_CONFIG:"jwt.validation.issuer.configuration",TOKEN_VERIFICATION:"jwt.validation.token.verification",METRICS:"jwt.validation.metrics",HELP:"jwt.validation.help"},PROCESSOR_TYPES:{MULTI_ISSUER_JWT_AUTHENTICATOR:"MultiIssuerJWTTokenAuthenticator"}},R={HELP_TEXT_KEYS:{TOKEN_LOCATION:"property.token.location.help",TOKEN_HEADER:"property.token.header.help",CUSTOM_HEADER_NAME:"property.custom.header.name.help",BEARER_TOKEN_PREFIX:"property.bearer.token.prefix.help",REQUIRE_VALID_TOKEN:"property.require.valid.token.help",JWKS_REFRESH_INTERVAL:"property.jwks.refresh.interval.help",MAXIMUM_TOKEN_SIZE:"property.maximum.token.size.help",ALLOWED_ALGORITHMS:"property.allowed.algorithms.help",REQUIRE_HTTPS_JWKS:"property.require.https.jwks.help"},PROPERTY_LABELS:{"Token Location":"property.token.location.help","Token Header":"property.token.header.help","Custom Header Name":"property.custom.header.name.help","Bearer Token Prefix":"property.bearer.token.prefix.help","Require Valid Token":"property.require.valid.token.help","JWKS Refresh Interval":"property.jwks.refresh.interval.help","Maximum Token Size":"property.maximum.token.size.help","Allowed Algorithms":"property.allowed.algorithms.help","Require HTTPS for JWKS URLs":"property.require.https.jwks.help"},I18N_KEYS:{JWT_VALIDATOR_LOADING:"jwt.validator.loading",JWT_VALIDATOR_TITLE:"jwt.validator.title",METRICS_TITLE:"jwt.validator.metrics.title",METRICS_TAB_NAME:"jwt.validator.metrics.tab.name",HELP_TITLE:"jwt.validator.help.title",HELP_TAB_NAME:"jwt.validator.help.tab.name"}},T={PATTERNS:{URL:new RegExp("^https?:\\/\\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$"),HTTPS_URL:new RegExp("^https:\\/\\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$"),SAFE_STRING:/^[a-zA-Z0-9._-]+$/},LIMITS:{ISSUER_NAME_MIN:2,ISSUER_NAME_MAX:100,AUDIENCE_MAX:500,CLIENT_ID_MAX:200,URL_MAX:2048}},b=(t,e={})=>{const s=document.createElement(t);return e.css&&(Array.isArray(e.css)?s.classList.add(...e.css):typeof e.css=="string"&&(s.className=e.css)),e.className&&(s.className=e.className),e.text&&(s.textContent=e.text),e.html&&(e.sanitized===!0?s.innerHTML=e.html:s.textContent=e.html),e.attributes&&Object.entries(e.attributes).forEach(([i,n])=>{if(i==="disabled"||i==="checked"||i==="readonly"||i==="required")if(n===!0||n==="true"||n==="")s.setAttribute(i,"");else{if(n===!1||n==="false"||n===null||n===void 0)return;s.setAttribute(i,n)}else s.setAttribute(i,n)}),e.events&&Object.entries(e.events).forEach(([i,n])=>{s.addEventListener(i,n)}),e.children&&e.children.forEach(i=>{i instanceof Element?s.appendChild(i):typeof i=="string"&&s.appendChild(document.createTextNode(i))}),s};class j{constructor(e={}){this.defaultOptions={i18n:e.i18n||{},cssClasses:e.cssClasses||f,validationEnabled:e.validationEnabled!==!1,containerClass:"form-field",labelSuffix:":",showDescriptions:e.showDescriptions!==!1}}createField(e){const{name:s,label:i,description:n,value:o="",type:r="text",required:a=!1,placeholder:c=n,validation:d=null,events:m={},cssClass:I="",helpText:u=null,disabled:v=!1,attributes:y={}}=e,p=this._createFieldContainer(s,I),k=this._createLabel(s,i,a);p.appendChild(k);const ce=this._createInput(s,r,o,c,v,y);if(p.appendChild(ce),this.defaultOptions.showDescriptions&&n){const le=this._createDescription(n);p.appendChild(le)}if(u){const le=this._createHelpText(u);p.appendChild(le)}this.defaultOptions.validationEnabled&&d&&this._addValidation(ce,d),this._attachEventHandlers(ce,m);const As=this._createErrorContainer(s);return p.appendChild(As),p}createButton(e){const{text:s,type:i="button",cssClass:n="",variant:o="primary",onClick:r=null,disabled:a=!1,icon:c=null,attributes:d={}}=e,m=["btn",`btn-${o}`,n].filter(Boolean),I={type:i,disabled:a,...d},u=b("button",{css:m,attributes:I});if(c){const v=b("i",{css:["fa",c]});u.appendChild(v),u.appendChild(document.createTextNode(" "))}return u.appendChild(document.createTextNode(s)),r&&u.addEventListener("click",r),u}createSection(e){const{title:s,content:i=[],cssClass:n="",collapsible:o=!1,expanded:r=!0}=e,a=b("div",{css:["form-section",n].filter(Boolean)});if(s){const d=b("div",{css:["form-section-header"],text:s});if(o){const m=b("i",{css:["fa",r?"fa-chevron-down":"fa-chevron-right"]});d.appendChild(m),d.addEventListener("click",()=>this._toggleSection(a)),d.style.cursor="pointer"}a.appendChild(d)}const c=b("div",{css:["form-section-content",!r&&o?"hidden":""].filter(Boolean)});return i.forEach(d=>{d instanceof Element&&c.appendChild(d)}),a.appendChild(c),a}validateContainer(e){const s=e.querySelectorAll("input, textarea, select"),i=[];let n=!0;return s.forEach(o=>{if(o._validate){const r=o._validate();r.isValid||(n=!1,i.push({field:o.name,error:r.error}))}}),{isValid:n,errors:i}}resetContainer(e){e.querySelectorAll("input, textarea, select").forEach(i=>{var o;i.value="",i.classList.remove("valid","invalid");const n=(o=i.parentElement)==null?void 0:o.querySelector(".field-error");n&&(n.classList.add("hidden"),n.textContent="")})}_createFieldContainer(e,s=""){return b("div",{css:[this.defaultOptions.containerClass,`field-container-${e}`,s].filter(Boolean)})}_createLabel(e,s,i){const n=s+this.defaultOptions.labelSuffix+(i?" *":"");return b("label",{text:n,attributes:{for:`field-${e}`},css:["field-label",i?"required":""].filter(Boolean)})}_createInput(e,s,i,n,o,r){const a={id:`field-${e}`,name:e,placeholder:n,...r};o===!0&&(a.disabled=o);const c=b(s==="textarea"?"textarea":"input",{css:[`field-${e}`,"form-input"],attributes:a});return s!=="textarea"&&c.setAttribute("type",s),i&&(s==="textarea"?c.textContent=i:c.value=i),c}_createDescription(e){return b("div",{css:["field-description"],text:e})}_createHelpText(e){return b("div",{css:["field-help","help-tooltip"],text:e,attributes:{title:e}})}_createErrorContainer(e){return b("div",{css:[`field-error-${e}`,"field-error","hidden"],attributes:{role:"alert","aria-live":"polite"}})}_addValidation(e,s){const i=()=>{const n=e.value,o=typeof s=="function"?s(n):s.validate(n),r=e.parentElement.querySelector(".field-error");return o.isValid?(e.classList.remove("invalid"),e.classList.add("valid"),r&&(r.classList.add("hidden"),r.textContent="")):(e.classList.remove("valid"),e.classList.add("invalid"),r&&(r.classList.remove("hidden"),r.textContent=o.error||"Invalid input")),o};e.addEventListener("blur",i),e.addEventListener("input",()=>{if(e.classList.contains("invalid")){e.classList.remove("invalid");const n=e.parentElement.querySelector(".field-error");n&&n.classList.add("hidden")}}),e._validate=i}_attachEventHandlers(e,s){Object.entries(s).forEach(([i,n])=>{typeof n=="function"&&e.addEventListener(i,n)})}_toggleSection(e){const s=e.querySelector(".form-section-content"),i=e.querySelector(".fa");s&&i&&(s.classList.toggle("hidden"),i.classList.toggle("fa-chevron-down"),i.classList.toggle("fa-chevron-right"))}}const lt=t=>new j().createField(t),dt=t=>new j().createButton(t),ut=t=>new j().createSection(t);class pt{static createField(e){return lt(e)}static createButton(e){return dt(e)}static createSection(e){return ut(e)}static createFactory(e){return new j(e)}}const Z=function(t,e,s){return t?{status:t.status,statusText:t.statusText||s||e||"Unknown error",responseText:t.responseText}:{status:0,statusText:"Unknown error",responseText:""}},fe=W.BASE_URL,ft=()=>{if(window.jwtAuthConfig&&window.jwtAuthConfig.processorId&&window.jwtAuthConfig.apiKey)return window.jwtAuthConfig;const t=new URLSearchParams(window.location.search),e=t.get("id")||t.get("processorId"),s=t.get("apiKey");return e?(window.jwtAuthConfig={processorId:e,apiKey:s||""},window.jwtAuthConfig):{processorId:"",apiKey:""}},q=(t,e,s=null,i=!0)=>{const n={method:t,url:e};if(i&&e.includes("/jwt/")){const r=ft();n.headers={"X-API-Key":r.apiKey,"X-Processor-Id":r.processorId},s&&r.processorId&&(s.processorId=r.processorId)}s&&(n.data=JSON.stringify(s),n.contentType="application/json");const o={method:n.method||"GET",headers:n.headers||{},credentials:"same-origin"};return n.data&&(o.body=n.data,n.contentType&&(o.headers["Content-Type"]=n.contentType)),fetch(n.url,o).then(r=>r.ok?r.json():r.text().then(a=>{throw Z({status:r.status,statusText:r.statusText,responseText:a})}))},mt=t=>q("POST",`${fe}/verify-token`,{token:t}).catch(e=>{throw Z(e)}),ht=()=>q("GET",`${fe}/metrics`).catch(t=>{throw Z(t)}),Q=t=>q("GET",`../nifi-api/processors/${t}`),me=(t,e)=>Q(t).then(s=>{const i={revision:s.revision,component:{id:t,properties:e}};return q("PUT",`../nifi-api/processors/${t}`,i)}),ee=async(t,e,s,i)=>{try{await gt(t,i)}catch(n){throw typeof i=="function"&&i({validate:()=>!1,error:n.message}),n}},gt=async(t,e)=>{if(!t)throw new Error("Token verifier element is required");const s=h.getI18n()||{},i=new j({i18n:s}),n=document.createElement("div");n.className=f.TOKEN_VERIFIER.CONTAINER;const o=document.createElement("div");o.className=f.TOKEN_VERIFIER.INPUT_SECTION;const r=i.createField({name:"token-input",label:s["processor.jwt.tokenInput"]||"Enter Token",description:s["processor.jwt.tokenInputDescription"]||"Paste your JWT token for verification",placeholder:s["processor.jwt.tokenInputPlaceholder"]||"Paste token here...",type:"textarea",required:!0,cssClass:"token-verifier-field",attributes:{rows:5},disabled:!1}),a=i.createButton({text:s["processor.jwt.verifyToken"]||"Verify Token",variant:"primary",cssClass:f.TOKEN_VERIFIER.VERIFY_BUTTON,icon:"fa-check"}),c=i.createButton({text:"Clear",variant:"secondary",cssClass:"clear-token-button",icon:"fa-trash"}),d=document.createElement("div");d.className="button-container",d.appendChild(a),d.appendChild(c),o.appendChild(r),o.appendChild(d);const m=document.createElement("div");m.className=f.TOKEN_VERIFIER.RESULTS_SECTION;const I=document.createElement("h3");I.textContent=s["processor.jwt.verificationResults"]||"Verification Results";const u=document.createElement("div");u.className=f.TOKEN_VERIFIER.RESULTS_CONTENT,m.appendChild(I),m.appendChild(u),n.appendChild(o),n.appendChild(m),t.appendChild(n),a.addEventListener("click",async()=>{const v=r.querySelector("#field-token-input"),y=v?v.value.trim():"";if(!y){C(u,null,s,"processor.jwt.noTokenProvided");return}u.innerHTML=`<div class="verifying">${s["processor.jwt.verifying"]||"Verifying token..."}</div>`;try{const p=await mt(y);vt(p,u,s)}catch(p){const k=p.jqXHR||{status:p.status||500,statusText:p.statusText||"Error",responseJSON:p.responseJSON||{error:p.message||"Unknown error"}};C(u,k,s)}}),c.addEventListener("click",()=>{ct(()=>{const v=r.querySelector("#field-token-input");v&&(v.value=""),u.innerHTML=""})}),typeof e=="function"&&e({validate:()=>!0,getValue:()=>{const v=r.querySelector("#field-token-input");return v?v.value:""},setValue:v=>{const y=r.querySelector("#field-token-input");y&&(y.value=v)}})},vt=(t,e,s)=>{const i=t.valid===!0,n=i?"valid":"invalid",o=i?s["processor.jwt.tokenValid"]||"Token is valid":s["processor.jwt.tokenInvalid"]||"Token is invalid";let r=`
        <div class="verification-status ${n}">
            <i class="fa ${i?"fa-check-circle":"fa-times-circle"}"></i>
            <span>${o}</span>
        </div>
    `;if(t.decoded){if(r+='<div class="token-details">',t.decoded.header&&(r+=`
                <div class="token-section">
                    <h4>${s["processor.jwt.tokenHeader"]||"Header"}</h4>
                    <pre>${JSON.stringify(t.decoded.header,null,2)}</pre>
                </div>
            `),t.decoded.payload){r+=`
                <div class="token-section">
                    <h4>${s["processor.jwt.tokenPayload"]||"Payload"}</h4>
                    <pre>${JSON.stringify(t.decoded.payload,null,2)}</pre>
                </div>
            `;const a=t.decoded.payload;if(r+='<div class="token-claims">',a.exp){const c=new Date(a.exp*1e3),d=c<new Date;r+=`
                    <div class="claim ${d?"expired":""}">
                        <strong>${s["processor.jwt.expiration"]||"Expiration"}:</strong>
                        ${c.toLocaleString()}
                        ${d?` <span class="expired-label">(${s["processor.jwt.expired"]||"Expired"})</span>`:""}
                    </div>
                `}a.iss&&(r+=`
                    <div class="claim">
                        <strong>${s["processor.jwt.issuer"]||"Issuer"}:</strong>
                        ${a.iss}
                    </div>
                `),a.sub&&(r+=`
                    <div class="claim">
                        <strong>${s["processor.jwt.subject"]||"Subject"}:</strong>
                        ${a.sub}
                    </div>
                `),r+="</div>"}r+="</div>"}t.error&&(r+=`
            <div class="verification-error">
                <strong>${s["processor.jwt.error"]||"Error"}:</strong>
                ${t.error}
            </div>
        `),e.innerHTML=r},Et=Object.freeze(Object.defineProperty({__proto__:null,cleanup:()=>{},init:ee},Symbol.toStringTag,{value:"Module"})),U=(t,e=!0)=>{const s=t==null,n=(s?"":String(t)).trim(),o=n===""||n.toLowerCase()==="null"||n.toLowerCase()==="undefined";return e&&(s||o)?{isValid:!1,error:"This field is required.",sanitizedValue:""}:{isValid:!0,sanitizedValue:n}},Tt=t=>{const e=U(t);if(!e.isValid)return{isValid:!1,error:"URL is required for processor ID extraction.",sanitizedValue:""};const s=e.sanitizedValue,n=/\/processors\/([a-f0-9-]+)/i.exec(s);return n?{isValid:!0,sanitizedValue:n[1].toLowerCase()}:{isValid:!1,error:"URL does not contain a valid processor ID.",sanitizedValue:""}},he=(t,e={})=>{const{httpsOnly:s=!1,maxLength:i=T.LIMITS.URL_MAX}=e,n=U(t);if(!n.isValid)return{isValid:!1,error:"URL is required.",sanitizedValue:""};const o=n.sanitizedValue;return o.length>i?{isValid:!1,error:`URL is too long (maximum ${i} characters).`,sanitizedValue:o}:(s?T.PATTERNS.HTTPS_URL:T.PATTERNS.URL).test(o)?{isValid:!0,sanitizedValue:o}:{isValid:!1,error:`Invalid URL format. Must be a valid ${s?"HTTPS":"HTTP/HTTPS"} URL.`,sanitizedValue:o}},bt=t=>{const e=U(t);if(!e.isValid)return{isValid:!1,error:"Issuer name is required.",sanitizedValue:""};const s=e.sanitizedValue;return s.length<T.LIMITS.ISSUER_NAME_MIN?{isValid:!1,error:`Issuer name must be at least ${T.LIMITS.ISSUER_NAME_MIN} characters long.`,sanitizedValue:s}:s.length>T.LIMITS.ISSUER_NAME_MAX?{isValid:!1,error:`Issuer name is too long (maximum ${T.LIMITS.ISSUER_NAME_MAX} characters).`,sanitizedValue:s}:T.PATTERNS.SAFE_STRING.test(s)?{isValid:!0,sanitizedValue:s}:{isValid:!1,error:"Issuer name can only contain letters, numbers, hyphens, underscores, and dots.",sanitizedValue:s}},It=(t,e=!1)=>{const s=U(t,e);if(!s.isValid)return s;if(!e&&s.sanitizedValue==="")return{isValid:!0,sanitizedValue:""};const i=s.sanitizedValue;return i.length>T.LIMITS.AUDIENCE_MAX?{isValid:!1,error:`Audience is too long (maximum ${T.LIMITS.AUDIENCE_MAX} characters).`,sanitizedValue:i}:{isValid:!0,sanitizedValue:i}},yt=(t,e=!1)=>{const s=U(t,e);if(!s.isValid)return s;if(!e&&s.sanitizedValue==="")return{isValid:!0,sanitizedValue:""};const i=s.sanitizedValue;return i.length>T.LIMITS.CLIENT_ID_MAX?{isValid:!1,error:`Client ID is too long (maximum ${T.LIMITS.CLIENT_ID_MAX} characters).`,sanitizedValue:i}:{isValid:!0,sanitizedValue:i}},wt=t=>{const e=[],s={},i=bt(t.issuerName);i.isValid||e.push(`Issuer Name: ${i.error}`),s.issuerName=i.sanitizedValue;const n=he(t.issuer,{httpsOnly:!1});n.isValid||e.push(`Issuer URI: ${n.error}`),s.issuer=n.sanitizedValue;const o=he(t["jwks-url"],{httpsOnly:!1});o.isValid||e.push(`JWKS URL: ${o.error}`),s["jwks-url"]=o.sanitizedValue;const r=It(t.audience,!1);r.isValid||e.push(`Audience: ${r.error}`),s.audience=r.sanitizedValue;const a=yt(t["client-id"],!1);return a.isValid||e.push(`Client ID: ${a.error}`),s["client-id"]=a.sanitizedValue,e.length>0?{isValid:!1,error:e.join(" "),sanitizedValue:s}:{isValid:!0,sanitizedValue:s}};class St{constructor(e){this.componentId=e,this.initialized=!1,this.timeouts=new Set}async initialize(e){try{e&&await e(),this.initialized=!0}catch(s){console.debug(s)}}isComponentInitialized(){return this.initialized}setTimeout(e,s){const i=setTimeout(()=>{this.timeouts.delete(i),e()},s);return this.timeouts.add(i),i}destroy(){this.timeouts.forEach(clearTimeout),this.timeouts.clear(),this.initialized=!1}}const g=O.getI18n()||{};let V=null;const te=()=>({name:M.ISSUER_CONFIG_EDITOR.DEFAULT_ISSUER_NAME,properties:{issuer:M.ISSUER_CONFIG_EDITOR.SAMPLE_ISSUER_URL,"jwks-url":M.ISSUER_CONFIG_EDITOR.SAMPLE_JWKS_URL,audience:M.ISSUER_CONFIG_EDITOR.SAMPLE_AUDIENCE,"client-id":M.ISSUER_CONFIG_EDITOR.SAMPLE_CLIENT_ID}}),Lt=t=>`<span class="success-message">${t}</span>`,_t=(t,e=!1)=>{const s=g["processor.jwt.ok"]||"OK",i=g["processor.jwt.validJwks"]||"Valid JWKS",n=g["processor.jwt.keysFound"]||"keys found",o=e?" <em>(Simulated response)</em>":"";return`${Lt(s)} ${i} (${t} ${n})${o}`},ge=t=>{const e={};return Object.entries(t).filter(([s])=>s.startsWith("issuer.")).forEach(([s,i])=>{const n=s.slice(7).split(".");if(n.length===2){const[o,r]=n;e[o]||(e[o]={}),e[o][r]=i}}),e},kt=t=>{var e,s;return((s=(e=t==null?void 0:t[0])==null?void 0:e.value)==null?void 0:s.trim())||""},ve=t=>{const e=s=>{const i=t.querySelector(s);return i?i.value.trim():""};return{issuerName:e(".issuer-name"),issuer:e(".field-issuer"),"jwks-url":e(".field-jwks-url"),audience:e(".field-audience"),"client-id":e(".field-client-id")}},Ct=()=>document.querySelector(".global-error-messages"),Rt=t=>{const e=document.createElement("div");e.className="issuer-config-editor",t.appendChild(e);const s=g["Jwt.Validation.Issuer.Configuration"]||"Issuer Configurations",i=document.createElement("h3");i.textContent=s,e.appendChild(i);const n=g["issuer.config.description"]||"Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.",o=document.createElement("p");o.textContent=n,e.appendChild(o);const r=document.createElement("div");r.className="global-error-messages issuer-form-error-messages",r.style.display="none",e.appendChild(r);const a=document.createElement("div");return a.className="issuers-container",e.appendChild(a),{container:e,issuersContainer:a,globalErrorContainer:r}},At=(t,e,s=null)=>{const i=document.createElement("button");i.className="add-issuer-button",i.textContent="Add Issuer",t.appendChild(i);const n=()=>{const o=te();D(e,o.name+"-"+Date.now(),o.properties,s)};i.addEventListener("click",n)},Ot=async(t,e)=>{const s=P(t);await Mt(e,s)},Nt=async(t,e)=>{const s=P(e),{container:i,issuersContainer:n}=Rt(t);At(i,n,s),await Ot(e,n)},P=t=>{const e=Tt(t);return e.isValid?e.sanitizedValue:""},Mt=async(t,e)=>{if(!e){const s=te();D(t,s.name,s.properties,e);return}try{const i=(await Q(e)).properties||{},n=ge(i);Object.keys(n).forEach(o=>{D(t,o,n[o],e)})}catch(s){console.debug(s);const i=te();D(t,i.name,i.properties,e)}},xt=(t,e)=>{const s=document.createElement("div");s.className="form-header";const i=document.createElement("label");i.textContent="Issuer Name:",s.appendChild(i);const n=document.createElement("input");n.type="text",n.className="issuer-name",n.placeholder="e.g., keycloak",n.title="Unique identifier for this issuer configuration. Use alphanumeric characters and hyphens only.",i.appendChild(n),t&&(n.value=t);const o=document.createElement("button");o.className="remove-issuer-button",o.title="Delete this issuer configuration",o.textContent="Remove",s.appendChild(o);const r=async()=>{const a=n.value||"Unnamed Issuer";await at(a,()=>{e(a)})};return o.addEventListener("click",r),s},jt=()=>{const t=document.createElement("div");t.className="jwks-button-wrapper";const e=document.createElement("button");e.type="button",e.className="verify-jwks-button",e.title="Test connectivity to the JWKS endpoint and verify it returns valid keys",e.textContent="Test Connection";const s=`<em>${g["jwksValidator.initialInstructions"]||"Click the button to validate JWKS"}</em>`,i=document.createElement("div");return i.className="verification-result",i.innerHTML=s,t.appendChild(e),t.appendChild(i),{testButtonWrapper:t,testButton:e,resultContainer:i}},Ut=(t,e)=>{const s=t.querySelector(".field-jwks-url"),i=s?s.closest(".form-field"):null;i?i.insertAdjacentElement("afterend",e):t.appendChild(e)},Ee=(t,e)=>{e.valid?t.innerHTML=_t(e.keyCount):C(t,{responseJSON:e},g,"processor.jwt.invalidJwks")},se=(t,e,s)=>{C(t,e,g,"processor.jwt.validationError")},Te=(t,e)=>{try{return fetch(W.ENDPOINTS.JWKS_VALIDATE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jwksValue:t}),credentials:"same-origin"}).then(s=>s.ok?s.json():s.text().then(i=>{const n=new Error(`HTTP ${s.status}: ${s.statusText}`);n.status=s.status,n.statusText=s.statusText,n.responseText=i;try{n.responseJSON=JSON.parse(i)}catch{}throw n})).then(s=>Ee(e,s)).catch(s=>se(e,s,!0))}catch(s){return se(e,s),Promise.reject(s)}},Vt=(t,e)=>{const{testButtonWrapper:s,testButton:i,resultContainer:n}=jt();Ut(t,s);const o=()=>{n.innerHTML=g["processor.jwt.testing"]||"Testing...";const r=e();Te(r,n)};i.addEventListener("click",o)},Pt=(t,e=null)=>{const s=e?"Save this issuer configuration to the NiFi processor":"Validate and save this issuer configuration (standalone mode)",i=document.createElement("button");i.className="save-issuer-button",i.title=s,i.textContent="Save Issuer";const n=document.createElement("div");n.className="issuer-form-error-messages";const o=()=>{n.innerHTML="",Se(t,n,e)};return i.addEventListener("click",o),t.appendChild(n),i},Dt=(t,e)=>{H(t,"issuer","Issuer URI","The URI of the token issuer (must match the iss claim)",e?e.issuer:"",'This value must exactly match the "iss" claim in JWT tokens. Example: https://auth.example.com/auth/realms/myrealm'),H(t,"jwks-url","JWKS URL","The URL of the JWKS endpoint",e?e["jwks-url"]:"","URL providing public keys for JWT signature verification. Usually ends with /.well-known/jwks.json"),Vt(t,()=>{const s=t.querySelector(".field-jwks-url");return s?s.value:""}),H(t,"audience","Audience","The expected audience claim value",e?e.audience:"",'Optional: Expected "aud" claim value in JWT tokens. Leave blank to accept any audience.'),H(t,"client-id","Client ID","The client ID for token validation",e?e["client-id"]:"",'Optional: Expected "azp" or "client_id" claim value. Used for additional token validation.')},Ht=(t,e,s=null)=>{const i=document.createElement("div");i.className="issuer-form";const n=xt(t,a=>{ke(i,a)});i.appendChild(n);const o=document.createElement("div");o.className="form-fields",i.appendChild(o),Dt(o,e);const r=Pt(i,s);return i.appendChild(r),i},D=(t,e,s,i=null)=>{const n=Ht(e,s,i);t.appendChild(n)},H=(t,e,s,i,n,o)=>{const r={name:e,label:s,description:i,value:n||"",placeholder:i,type:"text",required:!1,cssClass:"issuer-config-field",helpText:o||null,validation:e==="jwks-url"||e==="issuer"?c=>c!=null&&c.trim()?{isValid:!0}:{isValid:!1,error:"This field is required"}:null},a=pt.createField(r);t.appendChild(a)},be=t=>{if(!t.issuerName)return{isValid:!1,error:new Error(g["issuerConfigEditor.error.issuerNameRequired"]||"Issuer name is required.")};const s={issuer:t.issuer,"jwks-url":t["jwks-url"],audience:t.audience,"client-id":t["client-id"]};if(!s.issuer||!s["jwks-url"])return{isValid:!1,error:new Error(g["issuerConfigEditor.error.requiredFields"]||"Issuer URI and JWKS URL are required.")};const i=wt(t);return i.isValid||console.debug("Enhanced validation warnings:",i.error),{isValid:!0}},Ie=(t,e)=>{const s={issuer:e.issuer,"jwks-url":e["jwks-url"],audience:e.audience,"client-id":e["client-id"]},i={};return Object.keys(s).forEach(n=>{s[n]&&(i[`issuer.${t}.${n}`]=s[n])}),i},ye=async(t,e,s,i)=>{try{await me(t,s),X(i,g["issuerConfigEditor.success.saved"]||"Issuer configuration saved successfully.")}catch(n){C(i,n,g,"issuerConfigEditor.error.saveFailedTitle")}},we=t=>{X(t,g["issuerConfigEditor.success.savedStandalone"]||"Issuer configuration saved successfully (standalone mode).")},Se=async(t,e,s=null)=>{e.innerHTML="";const i=ve(t),n=be(i);if(!n.isValid){C(e,n.error,g,"issuerConfigEditor.error.title");return}const o=i.issuerName,r=Ie(o,i);s?await ye(s,o,r,e):we(e)},$t=(t,e)=>{const s={};return Object.keys(t).forEach(i=>{i.startsWith(`issuer.${e}.`)&&(s[i]=null)}),s},Le=(t,e,s=!1)=>{if(!t)return;const i=s?`Issuer "${e}" removed (standalone mode).`:`Issuer "${e}" removed successfully.`;X(t,i),t.style.display="block"},_e=(t,e)=>{if(t){const s=typeof e=="string"?new Error(e):e;C(t,s,g,"issuerConfigEditor.error.removeFailedTitle"),t.style.display="block"}else{const s=typeof e=="string"?e:e.message;console.error("Failed to remove issuer:",s)}},Ft=async(t,e,s)=>{try{const n=(await Q(t)).properties||{},o=$t(n,e);if(Object.keys(o).length===0&&e!=="sample-issuer"){console.info(`No properties found to remove for issuer: ${e}`);return}await me(t,o),Le(s,e,!1)}catch(i){_e(s,i)}},ke=async(t,e)=>{t.remove();const s=P(window.location.href),i=e,n=Ct();i&&s?await Ft(s,i,n):i&&!s?Le(n,i,!0):_e(n,i?"Cannot remove issuer: no processor context found":"Issuer name missing for removal")},Bt=(t,e)=>t?!0:(typeof e=="function"&&e(),!1),zt=()=>window.location.href,Jt=t=>{const s=`issuer-config-editor-${P(t)||"standalone"}`;setTimeout(()=>{V=new St(s),V.initialize(async()=>{})},0)},Ce=t=>{typeof t=="function"&&t()},ie=async(t,e)=>{if(Bt(t,e))try{const s=zt();Jt(s),await Nt(t,s),Ce(e)}catch(s){console.debug(s),Ce(e)}},Wt=Object.freeze(Object.defineProperty({__proto__:null,__test_exports:{saveIssuer:Se,removeIssuer:ke,addIssuerForm:D,addFormField:H,getProcessorIdFromUrl:P,_parseIssuerProperties:ge,_extractFieldValue:kt,_extractFormFields:ve,_validateIssuerFormData:be,_createPropertyUpdates:Ie,_saveIssuerToServer:ye,_saveIssuerStandalone:we,_handleJwksValidationResponse:Ee,_handleJwksValidationError:se,_performJwksValidation:Te},cleanup:()=>{V&&(V.destroy(),V=null)},init:ie},Symbol.toStringTag,{value:"Module"})),qt=function(t){if(!t)return"";try{const e=new Date(t);return isNaN(e.getTime())?(t!=="not-a-date"&&console.warn(`Invalid date format: ${t}`),t):e.toLocaleString()}catch(e){return console.warn(`Error formatting date: ${t}`,e),window._formattersErrors===void 0&&(window._formattersErrors=[]),window._formattersErrors.push({function:"formatDate",input:t,error:e.message,timestamp:new Date().toISOString()}),t}},Re=function(t){return t==null?"":new Intl.NumberFormat("en-US").format(t)},E=z("MetricsTab"),Ae=t=>(t*100).toFixed(1)+"%",Oe=t=>qt(t),ne=()=>{E.info("Initializing metrics tab"),document.getElementById("jwt-metrics-content")?E.debug("Metrics tab content already exists, skipping creation"):(E.info("Creating metrics tab content..."),Kt(),Gt())},Kt=()=>{const t=`
        <div id="jwt-metrics-content" class="jwt-tab-content" data-testid="metrics-tab-content">
            <div class="metrics-header">
                <h3>${h.getI18n().getProperty(R.I18N_KEYS.METRICS_TITLE)||"JWT Validation Metrics"}</h3>
                <button id="refresh-metrics-btn" class="btn btn-small" 
                data-testid="refresh-metrics-button">
                    <i class="fa fa-refresh"></i> Refresh
                </button>
            </div>
            
            <div class="metrics-summary" data-testid="metrics-summary">
                <div class="metric-card">
                    <h4>Total Validations</h4>
                    <div class="metric-value" id="total-validations">0</div>
                </div>
                <div class="metric-card">
                    <h4>Success Rate</h4>
                    <div class="metric-value" id="success-rate">0%</div>
                </div>
                <div class="metric-card">
                    <h4>Average Response Time</h4>
                    <div class="metric-value" id="avg-response-time">0ms</div>
                </div>
                <div class="metric-card">
                    <h4>Active Issuers</h4>
                    <div class="metric-value" id="active-issuers">0</div>
                </div>
            </div>
            
            <div class="issuer-metrics" data-testid="issuer-metrics">
                <h4>Issuer-Specific Metrics</h4>
                <div id="issuer-metrics-list" class="metrics-list">
                    <div class="metrics-loading">Loading metrics...</div>
                </div>
            </div>
            
            <div class="error-metrics" data-testid="error-metrics">
                <h4>Recent Errors</h4>
                <div id="error-metrics-list" class="metrics-list">
                    <div class="no-errors">No recent errors</div>
                </div>
            </div>
        </div>
    `,e=document.getElementById("metrics");if(E.info("Metrics tab pane found:",!!e),e)E.info("Appending metrics content to tab pane"),e.innerHTML=t,E.info("Metrics content appended, new length:",e.innerHTML.length);else{E.warn("Metrics tab pane not found, appending to container");const i=document.getElementById("jwt-validator-container");i&&i.insertAdjacentHTML("beforeend",t)}const s=document.getElementById("refresh-metrics-btn");s&&s.addEventListener("click",K)};let A=null,Ne=!0;const Gt=()=>{K(),typeof jest>"u"&&(A=setInterval(K,1e4))},K=async()=>{if(E.debug("Refreshing metrics"),!Ne){E.debug("Metrics endpoint not available, skipping refresh");return}try{const t=await Yt();Xt(t)}catch(t){E.error("Failed to refresh metrics:",t),Zt()}},Yt=async()=>{try{const t=await ht(),e=t.totalTokensValidated||0,s=t.validTokens||0,i=t.invalidTokens||0;return{totalValidations:e,successCount:s,failureCount:i,avgResponseTime:t.averageResponseTime||0,activeIssuers:t.activeIssuers||0,issuerMetrics:t.issuerMetrics||[],recentErrors:t.topErrors||[]}}catch(t){return E.error("Failed to fetch metrics from API:",t),t.status===404&&(E.info("Metrics endpoint not available (404), showing placeholder data"),Ne=!1,Qt()),{totalValidations:0,successCount:0,failureCount:0,avgResponseTime:0,activeIssuers:0,issuerMetrics:[],recentErrors:[]}}},Xt=t=>{const e=document.getElementById("total-validations");e&&(e.textContent=Re(t.totalValidations));const s=t.totalValidations>0?t.successCount/t.totalValidations:0,i=document.getElementById("success-rate");i&&(i.textContent=Ae(s));const n=document.getElementById("avg-response-time");n&&(n.textContent=`${t.avgResponseTime}ms`);const o=document.getElementById("active-issuers");o&&(o.textContent=t.activeIssuers);const r=t.issuerMetrics.map(c=>`
        <div class="issuer-metric-item">
            <div class="issuer-name">${c.name}</div>
            <div class="issuer-stats">
                <span class="stat">Validations: ${Re(c.validations)}</span>
                <span class="stat">Success Rate: 
                ${Ae(c.successRate/100)}</span>
                <span class="stat">Last: ${Oe(c.lastValidation)}</span>
            </div>
        </div>
    `).join(""),a=document.getElementById("issuer-metrics-list");if(a&&(a.innerHTML=r||'<div class="no-data">No issuer data available</div>'),t.recentErrors.length>0){const c=t.recentErrors.map(m=>`
            <div class="error-metric-item">
                <div class="error-details">
                    <span class="error-issuer">${m.issuer}</span>
                    <span class="error-message">${m.error}</span>
                    <span class="error-count">(${m.count} occurrences)</span>
                </div>
                <div class="error-time">${Oe(m.timestamp)}</div>
            </div>
        `).join(""),d=document.getElementById("error-metrics-list");d&&(d.innerHTML=c)}else{const c=document.getElementById("error-metrics-list");c&&(c.innerHTML='<div class="no-errors">No recent errors</div>')}},Zt=()=>{const t=document.getElementById("jwt-metrics-content");t&&(t.innerHTML=`
            <div class="metrics-error">
                <i class="fa fa-exclamation-triangle"></i>
                <p>Unable to load metrics. Please try again later.</p>
                <button onclick="location.reload()">Reload Page</button>
            </div>
        `)},Qt=()=>{const t=document.getElementById("jwt-metrics-content");t&&(t.innerHTML=`
            <div class="metrics-not-available">
                <i class="fa fa-info-circle"></i>
                <h3>Metrics Not Available</h3>
                <p>The metrics endpoint is not currently implemented.</p>
                <p>Metrics functionality will be available in a future release.</p>
            </div>
        `),A&&(clearInterval(A),A=null)},es=()=>{E.debug("Cleaning up metrics tab"),A&&(clearInterval(A),A=null)},ts=()=>h.getI18n().getProperty(R.I18N_KEYS.METRICS_TAB_NAME)||"Metrics";window.metricsTab={refreshMetrics:K};const ss=Object.freeze(Object.defineProperty({__proto__:null,cleanup:es,getDisplayName:ts,init:ne},Symbol.toStringTag,{value:"Module"})),L=z("HelpTab"),oe=()=>{L.info("Initializing help tab"),document.getElementById("jwt-help-content")?L.info("Help tab content already exists, skipping creation"):(L.info("Creating help tab content..."),is(),ns())},is=()=>{const t=`
        <div id="jwt-help-content" class="jwt-tab-content help-tab" data-testid="help-tab-content">
            <div class="help-header">
                <h3>${h.getI18n().getProperty(R.I18N_KEYS.HELP_TITLE)||"JWT Authenticator Help"}</h3>
            </div>
            
            <div class="help-sections">
                <div class="help-section">
                    <h4 class="collapsible-header active">
                        <i class="fa fa-chevron-down"></i> Getting Started
                    </h4>
                    <div class="collapsible-content show">
                        <p>The MultiIssuerJWTTokenAuthenticator processor validates JWT tokens from 
                        multiple issuers. Follow these steps to configure:</p>
                        <ol>
                            <li>Add at least one issuer configuration</li>
                            <li>Configure the JWKS URL or file path for each issuer</li>
                            <li>Set up authorization rules (optional)</li>
                            <li>Test your configuration using the Token Verification tab</li>
                        </ol>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Issuer Configuration
                    </h4>
                    <div class="collapsible-content">
                        <h5>Dynamic Properties</h5>
                        <p>Each issuer is configured using dynamic properties with the pattern:</p>
                        <code>jwt.issuer.&lt;issuer-name&gt;.jwks.url</code>
                        
                        <h5>Example Configurations</h5>
                        <div class="example-config">
                            <strong>Keycloak:</strong><br>
                            <code>jwt.issuer.keycloak.jwks.url = <br>
                                &nbsp;&nbsp;https://keycloak.example.com/realms/myrealm/<br>
                                &nbsp;&nbsp;protocol/openid-connect/certs
                            </code>
                        </div>
                        
                        <div class="example-config">
                            <strong>Auth0:</strong><br>
                            <code>jwt.issuer.auth0.jwks.url = 
                                https://yourdomain.auth0.com/.well-known/jwks.json</code>
                        </div>
                        
                        <div class="example-config">
                            <strong>Local File:</strong><br>
                            <code>jwt.issuer.local.jwks.file = /path/to/jwks.json</code>
                        </div>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Authorization Rules
                    </h4>
                    <div class="collapsible-content">
                        <p>Control access based on JWT claims using these properties:</p>
                        
                        <h5>Required Scopes</h5>
                        <p>Specify scopes that must be present in the token:</p>
                        <code>Required Scopes = read write admin</code>
                        
                        <h5>Required Roles</h5>
                        <p>Specify roles that must be present in the token:</p>
                        <code>Required Roles = user manager</code>
                        
                        <h5>Flow File Attributes</h5>
                        <p>The processor adds these attributes to flow files:</p>
                        <ul>
                            <li><code>jwt.subject</code> - Token subject (user)</li>
                            <li><code>jwt.issuer</code> - Token issuer</li>
                            <li><code>jwt.scopes</code> - Space-separated scopes</li>
                            <li><code>jwt.roles</code> - Space-separated roles</li>
                            <li><code>jwt.authorized</code> - true/false based on rules</li>
                        </ul>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Token Verification
                    </h4>
                    <div class="collapsible-content">
                        <p>Use the Token Verification tab to test JWT tokens:</p>
                        <ol>
                            <li>Paste a JWT token in the input field</li>
                            <li>Click "Verify Token"</li>
                            <li>Review the validation results</li>
                        </ol>
                        
                        <h5>Common Issues</h5>
                        <ul>
                            <li><strong>Invalid Signature:</strong> Check that the JWKS URL is 
                            correct</li>
                            <li><strong>Token Expired:</strong> Generate a new token</li>
                            <li><strong>Unknown Issuer:</strong> Add the issuer configuration</li>
                            <li><strong>Missing Scopes:</strong> Ensure token contains required 
                            scopes</li>
                        </ul>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Troubleshooting
                    </h4>
                    <div class="collapsible-content">
                        <h5>JWKS Loading Issues</h5>
                        <ul>
                            <li>Verify network connectivity to JWKS endpoints</li>
                            <li>Check SSL/TLS certificates for HTTPS endpoints</li>
                            <li>Ensure file paths are absolute for local JWKS files</li>
                            <li>Use the JWKS Validation button to test endpoints</li>
                        </ul>
                        
                        <h5>Performance Tips</h5>
                        <ul>
                            <li>JWKS are cached for 5 minutes by default</li>
                            <li>Use local JWKS files for better performance</li>
                            <li>Monitor the Metrics tab for performance data</li>
                        </ul>
                        
                        <h5>Security Best Practices</h5>
                        <ul>
                            <li>Always use HTTPS for JWKS endpoints</li>
                            <li>Rotate signing keys regularly</li>
                            <li>Implement proper authorization rules</li>
                            <li>Monitor failed validations in the Metrics tab</li>
                        </ul>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Additional Resources
                    </h4>
                    <div class="collapsible-content">
                        <ul class="resource-links">
                            <li><a href="https://jwt.io/introduction" target="_blank">
                                <i class="fa fa-external-link"></i> JWT Introduction
                            </a></li>
                            <li><a href="https://tools.ietf.org/html/rfc7517" target="_blank">
                                <i class="fa fa-external-link"></i> JSON Web Key (JWK) Specification
                            </a></li>
                            <li><a href="https://nifi.apache.org/docs.html" target="_blank">
                                <i class="fa fa-external-link"></i> Apache NiFi Documentation
                            </a></li>
                        </ul>
                        
                        <div class="help-footer">
                            <p><strong>Version:</strong> 1.0.0</p>
                            <p><strong>Support:</strong> support@cuioss.de</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,e=document.getElementById("help");if(L.info("Help tab pane found:",!!e),e)L.info("Appending help content to tab pane"),e.innerHTML=t,L.info("Help content appended, new length:",e.innerHTML.length);else{L.warn("Help tab pane not found, appending to container");const s=document.getElementById("jwt-validator-container");s&&s.insertAdjacentHTML("beforeend",t)}},ns=()=>{document.querySelectorAll(".collapsible-header").forEach(t=>{t.addEventListener("click",function(){const e=this.nextElementSibling,s=this.querySelector("i.fa");this.classList.toggle("active"),e&&e.classList.contains("collapsible-content")&&e.classList.toggle("show"),s&&(this.classList.contains("active")?(s.classList.remove("fa-chevron-right"),s.classList.add("fa-chevron-down")):(s.classList.remove("fa-chevron-down"),s.classList.add("fa-chevron-right"))),L.debug("Toggled help section:",this.textContent.trim())})})},os=Object.freeze(Object.defineProperty({__proto__:null,cleanup:()=>{L.debug("Cleaning up help tab")},getDisplayName:()=>h.getI18n().getProperty(R.I18N_KEYS.HELP_TAB_NAME)||"Help",init:oe},Symbol.toStringTag,{value:"Module"}));let Me="en";const xe=["en","de"],rs=function(){const e=(navigator.language||navigator.userLanguage||"en").split("-")[0];return xe.includes(e)?e:"en"},as=function(t){return xe.includes(t)?(Me=t,!0):!1},cs=function(){return Me};as(rs());function $(t,e={},s=document){var r;if(t==null)return null;let i;if(typeof t=="string"?i=s.querySelectorAll(t):Array.isArray(t)?i=t:i=[t],i.length===0)return null;const o={...{placement:"bottom-start",arrow:!0,theme:"light-border",appendTo:"parent"},...e};try{return Ge(Array.from(i),o)}catch(a){return(r=h==null?void 0:h.logError)==null||r.call(h,"Error initializing tooltip: "+a.message),null}}const ls={"ctrl+enter":"verify-token","cmd+enter":"verify-token","alt+v":"verify-token","ctrl+1":"goto-tab-1","ctrl+2":"goto-tab-2","ctrl+3":"goto-tab-3","cmd+1":"goto-tab-1","cmd+2":"goto-tab-2","cmd+3":"goto-tab-3","ctrl+s":"save-form","cmd+s":"save-form","alt+r":"reset-form",escape:"close-dialog",f1:"show-help","?":"show-help"},je=new Map,Ue=()=>{De(),document.addEventListener("keydown",Ve),window.__keyboardShortcutHandler=Ve,Es()},Ve=t=>{const e=Pe(t),s=ls[e];s&&ds(t)&&(t.preventDefault(),t.stopPropagation(),us(s))},Pe=t=>{const e=[];(t.ctrlKey||t.metaKey)&&e.push(t.ctrlKey?"ctrl":"cmd"),t.altKey&&e.push("alt"),t.shiftKey&&e.push("shift");const s=t.key?t.key.toLowerCase():"";return s==="enter"?e.push("enter"):s==="escape"?e.push("escape"):s==="f1"?e.push("f1"):s&&s.match(/^[a-z0-9?]$/)&&e.push(s),e.join("+")},ds=t=>{const e=t.target,s=e.tagName?e.tagName.toLowerCase():"";if(s==="input"||s==="textarea"){const i=Pe(t);return i==="ctrl+enter"||i==="cmd+enter"||i==="escape"}return!0},us=t=>{if(t!=null&&t.startsWith("custom-")){const e=je.get(t);if(e&&e.handler){e.handler();return}}switch(t){case"verify-token":ps();break;case"goto-tab-1":case"goto-tab-2":case"goto-tab-3":fs(parseInt(t.split("-")[2])-1);break;case"save-form":ms();break;case"reset-form":hs();break;case"close-dialog":gs();break;case"show-help":vs();break;default:console.debug("Unknown keyboard shortcut action:",t)}},ps=()=>{const t=document.querySelector(".verify-token-button:not(:disabled)");t&&t.offsetParent!==null&&(t.click(),F("Token verification started"))},fs=t=>{const e=document.querySelectorAll(".tab-nav-item");e.length>t&&(e[t].click(),F(`Switched to tab ${t+1}`))},ms=()=>{const e=Array.from(document.querySelectorAll("button:not(:disabled)")).find(s=>s.offsetParent!==null&&(s.textContent.includes("Save")||s.textContent.includes("Apply")));e&&(e.click(),F("Form save triggered"))},hs=()=>{const e=Array.from(document.querySelectorAll("button:not(:disabled)")).find(s=>s.offsetParent!==null&&(s.textContent.includes("Reset")||s.textContent.includes("Clear")));e&&(e.click(),F("Form reset triggered"))},gs=()=>{const t=document.querySelector(".ui-dialog-titlebar-close")||Array.from(document.querySelectorAll("button")).find(e=>e.offsetParent!==null&&(e.textContent.includes("Cancel")||e.textContent.includes("Close")));t&&(t.click(),F("Dialog closed"))},vs=()=>{const e=`
        <div class="keyboard-shortcuts-modal">
            <div class="modal-overlay"></div>
            <div class="modal-content">
                
        <div class="keyboard-shortcuts-help">
            <h3>Keyboard Shortcuts</h3>
            <div class="shortcuts-grid">
                <div class="shortcut-group">
                    <h4>Token Verification</h4>
                    <div class="shortcut-item">
                        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> or <kbd>Alt</kbd>+<kbd>V</kbd>
                        <span>Verify Token</span>
                    </div>
                </div>
                <div class="shortcut-group">
                    <h4>Navigation</h4>
                    <div class="shortcut-item">
                        <kbd>Ctrl</kbd>+<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>
                        <span>Switch Tabs</span>
                    </div>
                </div>
                <div class="shortcut-group">
                    <h4>Forms</h4>
                    <div class="shortcut-item">
                        <kbd>Ctrl</kbd>+<kbd>S</kbd>
                        <span>Save Form</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Alt</kbd>+<kbd>R</kbd>
                        <span>Reset Form</span>
                    </div>
                </div>
                <div class="shortcut-group">
                    <h4>General</h4>
                    <div class="shortcut-item">
                        <kbd>Esc</kbd>
                        <span>Close Dialog</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>F1</kbd> or <kbd>?</kbd>
                        <span>Show Help</span>
                    </div>
                </div>
            </div>
        </div>
    
                <button class="close-help-btn">Close</button>
            </div>
        </div>
    `,s=document.createElement("div");s.innerHTML=e;const i=s.firstElementChild;document.body.appendChild(i);const n=()=>i.remove();i.querySelector(".close-help-btn").addEventListener("click",n),i.querySelector(".modal-overlay").addEventListener("click",n)},F=t=>{const e=document.createElement("div");e.className="keyboard-action-feedback",e.textContent=t,document.body.appendChild(e),setTimeout(()=>{e.classList.add("fade-out"),setTimeout(()=>e.remove(),300)},2e3)},Es=()=>{sessionStorage.getItem("nifi-jwt-shortcuts-shown")||setTimeout(()=>{const t=`
            <div class="shortcuts-hint">
                <span>💡 Press <kbd>F1</kbd> or <kbd>?</kbd> for keyboard shortcuts</span>
                <button class="close-hint">×</button>
            </div>
        `,e=document.createElement("div");e.innerHTML=t;const s=e.firstElementChild;document.body.appendChild(s),s.querySelector(".close-hint").addEventListener("click",()=>s.remove()),setTimeout(()=>{s.classList.add("fade-out"),setTimeout(()=>s.remove(),300)},5e3),sessionStorage.setItem("nifi-jwt-shortcuts-shown","true")},2e3)},De=()=>{window.__keyboardShortcutHandler&&(document.removeEventListener("keydown",window.__keyboardShortcutHandler),delete window.__keyboardShortcutHandler),je.clear(),document.querySelectorAll(".keyboard-shortcuts-modal, .keyboard-action-feedback, .shortcuts-hint").forEach(t=>t.remove())},re=z("tabManager"),He=()=>{re.debug("Initializing tab manager");const t=new WeakMap,e=s=>{const i=s.target.closest(".jwt-tabs-header .tabs a"),n=s.target.closest('[data-toggle="tab"]'),o=i||n;if(!o||(s.preventDefault(),n&&t.get(o)))return;n&&(t.set(o,!0),setTimeout(()=>t.delete(o),100));const r=o.getAttribute("href")||o.getAttribute("data-target");if(!r||r==="#")return;document.querySelectorAll(".jwt-tabs-header .tabs li").forEach(c=>c.classList.remove("active")),o.parentElement&&o.parentElement.classList.add("active"),document.querySelectorAll(".tab-pane").forEach(c=>c.classList.remove("active"));const a=document.querySelector(r);a&&a.classList.add("active"),re.debug("Switched to tab:",r),document.dispatchEvent(new CustomEvent("tabChanged",{detail:{tabId:r,tabName:o.textContent.trim()}}))};document.addEventListener("click",e),window.__tabClickHandler=e},Ts=()=>{window.__tabClickHandler&&(document.removeEventListener("click",window.__tabClickHandler),delete window.__tabClickHandler),re.debug("Tab manager cleaned up")},l=z("NiFi-Main"),bs=()=>{try{cs();const t=window.location.href.includes("nifi-cuioss-ui")||window.location.href.includes("localhost:9095")||window.location.pathname.includes("/nifi-cuioss-ui");return typeof h.registerCustomUiTab=="function"&&!t?(h.registerCustomUiTab(x.COMPONENT_TABS.ISSUER_CONFIG,Wt),h.registerCustomUiTab(x.COMPONENT_TABS.TOKEN_VERIFICATION,Et),h.registerCustomUiTab(x.COMPONENT_TABS.METRICS,ss),h.registerCustomUiTab(x.COMPONENT_TABS.HELP,os)):l.info("Skipping tab registration in standalone mode"),window.jwtComponentsRegistered=!0,!0}catch(t){return console.error("JWT UI component registration failed:",t),!1}},$e=()=>{try{document.querySelectorAll(f.SELECTORS.PROPERTY_LABEL).forEach(t=>{const e=t.textContent.trim(),s=R.PROPERTY_LABELS[e];if(s&&!t.querySelector(f.SELECTORS.HELP_TOOLTIP)){const i=h.getI18n().getProperty(s);if(i){const n=document.createElement("span");n.className=`${f.CLASSES.HELP_TOOLTIP} ${f.CLASSES.FA} ${f.CLASSES.FA_QUESTION_CIRCLE}`,n.setAttribute("title",i),t.appendChild(n)}}}),$(f.SELECTORS.HELP_TOOLTIP),$("[title]",{placement:"bottom"}),$(".help-tooltip",{placement:"right"}),ys(),Is()}catch(t){l.debug("JWT UI help tooltips setup failed:",t)}},Is=()=>{if(typeof MutationObserver<"u"){const e=new MutationObserver(s=>{let i=!1;s.forEach(n=>{n.type==="childList"&&n.addedNodes.forEach(o=>{var r;if(o.nodeType===Node.ELEMENT_NODE){const a=((r=o.textContent)==null?void 0:r.trim())||"";(a.includes("Loading JWT")||a.includes("Loading Validator")||a.includes("Loading JWT Validator UI"))&&(i=!0)}})}),i&&(l.debug("MutationObserver detected loading message, hiding immediately"),_())});e.observe(document.body,{childList:!0,subtree:!0,characterData:!0}),window.jwtLoadingObserver=e}const t=setInterval(()=>{var s,i;((i=(s=document.querySelector("*"))==null?void 0:s.innerText)==null?void 0:i.includes("Loading JWT Validator UI"))&&(l.debug("Periodic check detected loading message, hiding immediately"),_())},100);setTimeout(()=>{clearInterval(t),l.debug("Periodic loading check completed")},1e4),l.debug("Continuous loading monitoring set up successfully")},ys=()=>{try{const t=new MutationObserver(e=>{e.forEach(s=>{s.type==="childList"&&s.addedNodes.forEach(i=>{if(i.nodeType===Node.ELEMENT_NODE){const n=i.querySelectorAll("[title]"),o=i.querySelectorAll(".help-tooltip");n.length>0&&$(Array.from(n),{placement:"bottom"}),o.length>0&&$(Array.from(o),{placement:"right"})}})})});t.observe(document.body,{childList:!0,subtree:!0}),window.nifiJwtTooltipObserver||(window.nifiJwtTooltipObserver=t)}catch(t){console.debug("Failed to setup tooltip observer:",t)}},G=()=>{try{const t=document.getElementById(f.IDS.LOADING_INDICATOR);if(t)t.style.display="none",t.style.visibility="hidden",t.setAttribute("aria-hidden","true"),t.classList.add("hidden"),t.style.removeProperty&&(t.style.removeProperty("display"),t.style.display="none"),l.debug("Loading indicator successfully hidden");else{const s=document.querySelector('#loading-indicator, .loading-indicator, [id*="loading"]');s&&(s.style.display="none",s.style.visibility="hidden")}const e=document.getElementById(f.IDS.JWT_VALIDATOR_TABS);e&&(e.style.display="",e.style.visibility="visible"),ae(),window.jwtUISetupComplete=!0}catch(t){console.error("Error in setupUI():",t);try{const e=document.getElementById("loading-indicator");e&&(e.style.display="none")}catch(e){console.error("Even fallback setupUI failed:",e)}}},ae=()=>{const t=h.getI18n(),e=document.getElementById(f.IDS.LOADING_INDICATOR);e&&(e.textContent=t.getProperty(R.I18N_KEYS.JWT_VALIDATOR_LOADING)||"Loading...");const s=document.querySelector(f.SELECTORS.JWT_VALIDATOR_TITLE);s&&(s.textContent=t.getProperty(R.I18N_KEYS.JWT_VALIDATOR_TITLE)||"JWT Validator")},ws=()=>{document.addEventListener("dialogOpen",t=>{var n;const e=t.detail,s=Array.isArray(e)?e[0]:e;((n=s==null?void 0:s.classList)==null?void 0:n.contains(f.CLASSES.PROCESSOR_DIALOG))&&setTimeout(()=>{var r,a;const o=(a=(r=s.querySelector(f.SELECTORS.PROCESSOR_TYPE))==null?void 0:r.textContent)==null?void 0:a.trim();o!=null&&o.includes(x.PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR)&&($e(),ae())},W.TIMEOUTS.DIALOG_DELAY)})},Fe=()=>{try{l.info("Initializing tab content components..."),l.info("Initializing issuer config tab");const t=document.getElementById("issuer-config");if(t){const s=()=>l.debug("Issuer config initialized"),i=window.location.href;ie(t,s,i)}else l.warn("Issuer config tab element not found");l.info("Initializing token verification tab");const e=document.getElementById("token-verification");e?ee(e,{},"jwt",()=>l.debug("Token verifier initialized")):l.warn("Token verification tab element not found"),l.info("Initializing metrics tab"),ne(),l.info("Initializing help tab"),oe(),document.addEventListener("tabChanged",s=>{const i=s.detail;switch(l.debug("Tab changed to:",i.tabId),i.tabId){case"#issuer-config":{const n=document.getElementById("issuer-config");if(n){const o=()=>l.debug("Issuer config re-initialized"),r=window.location.href;ie(n,o,r)}break}case"#token-verification":{const n=document.getElementById("token-verification");n&&ee(n,{},"jwt",()=>l.debug("Token verifier re-initialized"));break}case"#metrics":ne();break;case"#help":oe();break;default:l.warn("Unknown tab:",i.tabId)}}),l.info("Tab content initialization setup complete")}catch(t){l.error("Failed to initialize tab content:",t)}},Ss=()=>new Promise(t=>{try{if(l.debug("JWT UI initialization starting..."),window.jwtInitializationInProgress||window.jwtUISetupComplete){l.debug("Initialization already in progress or complete, skipping"),t(!0);return}window.jwtInitializationInProgress=!0,l.info("PRIORITY: Hiding loading indicator immediately"),_(),l.debug("Registering JWT UI components...");const e=bs();e?(l.debug("Component registration successful, setting up UI..."),G(),He(),We(),ws(),Ue(),Fe(),l.info("JWT UI initialization completed successfully")):(console.warn("Component registration failed, using fallback..."),G(),He(),We(),Ue(),Fe()),setTimeout(()=>{l.debug("100ms safety check: ensuring loading indicator is hidden"),_()},100),setTimeout(()=>{l.debug("500ms safety check: ensuring loading indicator is hidden"),_()},500),setTimeout(()=>{l.debug("Final 1s fallback: ensuring UI is visible and loading hidden"),G(),_(),ae()},W.TIMEOUTS.DIALOG_DELAY),window.jwtInitializationInProgress=!1,t(e)}catch(e){console.error("JWT UI initialization failed:",e),_(),G(),window.jwtInitializationInProgress=!1,t(!1)}}),_=()=>{try{l.debug("hideLoadingIndicatorRobust: Starting comprehensive loading indicator removal"),Ls(),_s(),ks(),window.jwtLoadingIndicatorHidden=!0,window.jwtHideLoadingIndicator=_,l.debug("hideLoadingIndicatorRobust: Comprehensive loading indicator removal completed")}catch(t){console.warn("Error in hideLoadingIndicatorRobust:",t),Rs()}},Ls=()=>{const t=document.getElementById(f.IDS.LOADING_INDICATOR);if(t){const e=t.textContent;t.style.setProperty("display","none","important"),t.style.setProperty("visibility","hidden","important"),t.style.setProperty("opacity","0","important"),t.setAttribute("aria-hidden","true"),t.classList.add("hidden"),t.textContent="",t.innerHTML="",l.debug(`Loading indicator hidden via standard ID (was: "${e}")`)}},_s=()=>{["#loading-indicator",".loading-indicator",'[id*="loading"]','[class*="loading"]'].forEach(e=>{try{document.querySelectorAll(e).forEach(i=>{i.style.setProperty("display","none","important"),i.style.setProperty("visibility","hidden","important"),i.style.setProperty("opacity","0","important"),i.setAttribute("aria-hidden","true"),i.classList.add("hidden")})}catch(s){console.debug("Selector ignored:",e,s)}})},ks=()=>{var n;const t=document.getElementsByTagName("*"),e=["Loading JWT Validator UI","Loading JWT","Loading"];let s=0;l.debug("hideLoadingByTextContent: Starting scan of",t.length,"elements");for(const o of t){const r=((n=o.textContent)==null?void 0:n.trim())||"";e.some(c=>r.includes(c))&&(l.debug("Found element with loading text:",r,"on element:",o.tagName,o.id,o.className),Cs(r)?(Be(o,r),s++):l.debug("Element not hidden because shouldHideElement returned false"))}["loading-indicator","simulated-loading","jwt-loading","validator-loading"].forEach(o=>{var a,c;const r=document.getElementById(o);r&&(l.debug(`Found element with ID ${o}:`,(a=r.textContent)==null?void 0:a.trim()),(c=r.textContent)!=null&&c.trim().includes("Loading")&&(Be(r,r.textContent.trim()),s++))}),l.debug(`hideLoadingByTextContent: Hidden ${s} loading indicators`)},Cs=t=>{l.debug("shouldHideElement checking:",t);const e=t.length<100&&(t==="Loading JWT Validator UI..."||t.startsWith("Loading JWT")||t.startsWith("Loading"));return l.debug("shouldHideElement result:",e),e},Be=(t,e)=>{t.style.setProperty("display","none","important"),t.style.setProperty("visibility","hidden","important"),t.style.setProperty("opacity","0","important"),t.setAttribute("aria-hidden","true"),t.classList.add("hidden"),t.childNodes.length===1&&t.childNodes[0].nodeType===Node.TEXT_NODE&&(t.textContent=""),l.debug(`Hidden element with loading text: "${e}"`)},Rs=()=>{try{const t=document.getElementById("loading-indicator");t&&(t.style.display="none",l.debug("Emergency fallback: basic loading indicator hidden"))}catch(t){console.error("Even emergency fallback failed:",t)}},ze=()=>{try{De(),Ts(),window.nifiJwtTooltipObserver&&(window.nifiJwtTooltipObserver.disconnect(),window.nifiJwtTooltipObserver=null),window.jwtLoadingObserver&&(window.jwtLoadingObserver.disconnect(),window.jwtLoadingObserver=null)}catch(t){console.debug(t)}},Je=()=>[{id:"issuer-config-editor",status:"registered"},{id:"token-verifier",status:"registered"},{id:"help-tooltips",status:"registered"}],We=$e,qe=()=>Ss(),Ke=()=>{_()};typeof module<"u"&&module.exports&&(module.exports={init:qe,hideLoadingIndicatorImmediate:Ke,getComponentStatus:Je,cleanup:ze}),w.cleanup=ze,w.getComponentStatus=Je,w.hideLoadingIndicatorImmediate=Ke,w.init=qe,Object.defineProperty(w,Symbol.toStringTag,{value:"Module"})});
