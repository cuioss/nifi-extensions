(function(w,O){typeof exports=="object"&&typeof module<"u"?O(exports,require("nf.Common"),require("tippy.js")):typeof define=="function"&&define.amd?define(["exports","nf.Common","tippy.js"],O):(w=typeof globalThis<"u"?globalThis:w||self,O(w.nifiCuiossUI={},w.nfCommon,w.tippy))})(this,function(w,O,Ge){"use strict";function Ye(e){const t=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(e){for(const s in e)if(s!=="default"){const i=Object.getOwnPropertyDescriptor(e,s);Object.defineProperty(t,s,i.get?i:{enumerable:!0,get:()=>e[s]})}}return t.default=e,Object.freeze(t)}const g=Ye(O),S={DEBUG:0,INFO:1,WARN:2,ERROR:3,FATAL:4},Xe=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"||window.location.hostname.startsWith("192.168.")||window.location.hostname.endsWith(".local")||window.location.search.includes("debug=true")||localStorage.getItem("nifi-debug")==="true"?S.DEBUG:S.WARN;class F{constructor(t="NiFi-UI",s=Xe){this.component=t,this.logLevel=s,this.startTime=Date.now()}_getTimestamp(){const t=new Date,s=t.getTime()-this.startTime;return`[${t.toISOString()}] (+${s}ms)`}_formatMessage(t,s,...i){return[`${this._getTimestamp()} [${t}] ${this.component}:`,s,...i]}_shouldLog(t){return t>=this.logLevel}debug(t,...s){this._shouldLog(S.DEBUG)&&console.debug(...this._formatMessage("DEBUG",t,...s))}info(t,...s){this._shouldLog(S.INFO)&&console.info(...this._formatMessage("INFO",t,...s))}warn(t,...s){this._shouldLog(S.WARN)&&console.warn(...this._formatMessage("WARN",t,...s))}error(t,...s){this._shouldLog(S.ERROR)&&console.error(...this._formatMessage("ERROR",t,...s))}fatal(t,...s){this._shouldLog(S.FATAL)&&console.error(...this._formatMessage("FATAL",t,...s))}child(t){return new F(`${this.component}:${t}`,this.logLevel)}setLogLevel(t){this.logLevel=t}time(t){const s=performance.now();return this.debug(`Starting operation: ${t}`),()=>{const i=performance.now()-s;this.debug(`Operation completed: ${t} (${i.toFixed(2)}ms)`)}}}const N=new F("NiFi-UI"),z=e=>new F(e);typeof window<"u"&&(window.nifiDebug={enable:()=>{localStorage.setItem("nifi-debug","true"),N.setLogLevel(S.DEBUG),N.info("Debug logging enabled")},disable:()=>{localStorage.removeItem("nifi-debug"),N.setLogLevel(S.WARN),N.info("Debug logging disabled")},setLevel:e=>{N.setLogLevel(e),N.info(`Log level set to: ${Object.keys(S)[e]}`)}});const Ze=e=>e.map(t=>typeof t=="string"?t:t.msg||"Error detail missing").join(", "),pe=e=>e?typeof e.message=="string"?e.message:Array.isArray(e.errors)&&e.errors.length>0?Ze(e.errors):null:null,Qe=e=>{if(!e)return null;try{const t=JSON.parse(e),s=pe(t);return s!==null?s:e}catch(t){return console.debug("Failed to parse responseText as JSON:",t),e}},X=(e,t)=>{if(e==null)return t["processor.jwt.unknownError"]||"Unknown error";const s=String(e),i=s.trim(),n=s.toLowerCase();return i===""||n==="null"||n==="undefined"?t["processor.jwt.unknownError"]||"Unknown error":e},et=(e,t)=>{if(!e)return t["processor.jwt.unknownError"]||"Unknown error";const s=pe(e.responseJSON);if(s)return X(s,t);const i=Qe(e.responseText);if(i)return X(i,t);const n=e.statusText||e.message;return X(n,t)},_=(e,t,s,i="processor.jwt.validationError",n={})=>{const{type:o="error",closable:r=!1,autoHide:a=!1}=n,l=et(t,s),d=s[i]||"Error",u=`
        <div class="error-message ${tt(o)} ${r?"closable":""}">
            <div class="error-content">
                <strong>${d}:</strong> ${l}
            </div>
            ${r?'<button class="close-error" aria-label="Close error">&times;</button>':""}
        </div>
    `,I=e[0]||e;if(I.innerHTML=u,r){const f=I.querySelector(".close-error");f&&f.addEventListener("click",()=>{const C=I.querySelector(".error-message");C&&(C.style.transition="opacity 0.3s",C.style.opacity="0",setTimeout(()=>C.remove(),300))})}a&&setTimeout(()=>{const f=I.querySelector(".error-message");f&&(f.style.transition="opacity 0.3s",f.style.opacity="0",setTimeout(()=>f.remove(),300))},5e3)},Z=(e,t,s={})=>{const{autoHide:i=!0}=s,o=`
        <div class="success-message ${i?"auto-dismiss":""}">
            <div class="success-content">${t}</div>
        </div>
    `,r=e[0]||e;r.innerHTML=o,i&&setTimeout(()=>{const a=r.querySelector(".success-message");a&&a.remove()},5e3)},tt=e=>{switch(e){case"validation":return"validation-error";case"network":return"network-error";case"server":return"server-error";default:return""}},me=e=>{const{title:t,message:s,confirmText:i="Delete",cancelText:n="Cancel",type:o="danger",onConfirm:r,onCancel:a}=e;return new Promise(l=>{document.querySelectorAll(".confirmation-dialog").forEach(p=>p.remove());const d=st(t,s,i,n,o),v=document.createElement("div");v.innerHTML=d;const m=v.firstElementChild;document.body.appendChild(m),it(m,l,r,a),requestAnimationFrame(()=>{m.classList.add("show");const p=m.querySelector(".cancel-button");p&&p.focus()})})},J=e=>{const t=document.createElement("div");return t.textContent=e,t.innerHTML},st=(e,t,s,i,n)=>{const o=ot(n),r=rt(n);return`
        <div class="confirmation-dialog ${o}">
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <div class="dialog-header">
                    <div class="dialog-icon">${r}</div>
                    <h3 class="dialog-title">${J(e)}</h3>
                </div>
                <div class="dialog-body">
                    <p class="dialog-message">${J(t)}</p>
                </div>
                <div class="dialog-footer">
                    <button class="cancel-button">${J(i)}</button>
                    <button class="confirm-button ${n}-button">
                        ${J(s)}
                    </button>
                </div>
            </div>
        </div>
    `},it=(e,t,s,i)=>{const n=()=>{fe(e),s&&s(),t(!0)},o=()=>{fe(e),i&&i(),t(!1)},r=e.querySelector(".confirm-button"),a=e.querySelector(".cancel-button");r&&r.addEventListener("click",n),a&&a.addEventListener("click",o);const l=e.querySelector(".dialog-overlay");l&&l.addEventListener("click",o),e.addEventListener("keydown",d=>{d.key==="Escape"?(d.preventDefault(),o()):d.key==="Enter"&&d.target.classList.contains("confirm-button")&&(d.preventDefault(),n())}),nt(e)},fe=e=>{e.classList.remove("show"),setTimeout(()=>{e.remove()},300)},nt=e=>{const t=e.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),s=t[0],i=t[t.length-1];e.addEventListener("keydown",n=>{n.key==="Tab"&&(n.shiftKey?document.activeElement===s&&(n.preventDefault(),i&&i.focus()):document.activeElement===i&&(n.preventDefault(),s&&s.focus()))})},ot=e=>{switch(e){case"danger":return"dialog-danger";case"warning":return"dialog-warning";case"info":return"dialog-info";default:return"dialog-danger"}},rt=e=>{switch(e){case"danger":return"🗑️";case"warning":return"⚠️";case"info":return"ℹ️";default:return"🗑️"}},at=(e,t)=>me({title:"Remove Issuer Configuration",message:`Are you sure you want to remove the issuer "${e}"? This action cannot be undone.`,confirmText:"Remove",cancelText:"Cancel",type:"danger",onConfirm:t}),ct=e=>me({title:"Clear Form Data",message:"Are you sure you want to clear all form data? Any unsaved changes will be lost.",confirmText:"Clear",cancelText:"Cancel",type:"warning",onConfirm:e}),q={BASE_URL:"nifi-api/processors/jwt",NIFI_BASE_URL:"nifi-api/processors",ENDPOINTS:{VALIDATE_JWKS_URL:"/validate-jwks-url",VERIFY_TOKEN:"/verify-token",GET_ISSUER_CONFIG:"/issuer-config",SET_ISSUER_CONFIG:"/issuer-config",JWKS_VALIDATE_URL:"nifi-api/processors/jwks/validate-url",JWT_VERIFY_TOKEN:"nifi-api/processors/jwt/verify-token"},TIMEOUTS:{DEFAULT:5e3,LONG_OPERATION:1e4,SHORT_OPERATION:2e3,DIALOG_DELAY:500,UI_FALLBACK_TIMEOUT:3e3,TOKEN_CACHE_DURATION:36e5,ERROR_DISPLAY_TIMEOUT:5e3}},h={CLASSES:{SUCCESS_MESSAGE:"success-message",ERROR_MESSAGE:"error-message",WARNING_MESSAGE:"warning-message",LOADING:"loading",HIDDEN:"hidden",DISABLED:"disabled",INVALID:"invalid",VALID:"valid",PROPERTY_LABEL:"property-label",HELP_TOOLTIP:"help-tooltip",PROCESSOR_DIALOG:"processor-dialog",PROCESSOR_TYPE:"processor-type",JWT_VALIDATOR_TITLE:"jwt-validator-title",FA:"fa",FA_QUESTION_CIRCLE:"fa-question-circle"},SELECTORS:{ERROR_CONTAINER:".error-container",SUCCESS_CONTAINER:".success-container",LOADING_INDICATOR:".loading-indicator",FORM_GROUP:".form-group",INPUT_FIELD:".input-field",BUTTON:".button",TOOLTIP:".tooltip",PROPERTY_LABEL:".property-label",HELP_TOOLTIP:".help-tooltip",PROCESSOR_DIALOG:".processor-dialog",PROCESSOR_TYPE:".processor-type",JWT_VALIDATOR_TITLE:".jwt-validator-title"},IDS:{LOADING_INDICATOR:"loading-indicator",JWT_VALIDATOR_TABS:"jwt-validator-tabs"},ISSUER_CONFIG:{CONTAINER:"issuer-config-editor",ISSUERS_CONTAINER:"issuers-container",GLOBAL_ERROR_MESSAGES:"global-error-messages",ADD_ISSUER_BUTTON:"add-issuer-button",REMOVE_ISSUER_BUTTON:"remove-issuer-button",SAVE_ISSUER_BUTTON:"save-issuer-button",ISSUER_FORM:"issuer-form",FORM_HEADER:"form-header",FORM_FIELDS:"form-fields"},TOKEN_VERIFIER:{CONTAINER:"token-verification-container",INPUT_SECTION:"token-input-section",RESULTS_SECTION:"token-results-section",TOKEN_INPUT:"token-input",VERIFY_BUTTON:"verify-token-button",RESULTS_CONTENT:"token-results-content",TOKEN_ERROR:"token-error",TOKEN_LOADING:"token-loading",TOKEN_VALID:"token-valid",TOKEN_INVALID:"token-invalid",TOKEN_DETAILS:"token-details",TOKEN_ERROR_DETAILS:"token-error-details",TOKEN_ERROR_MESSAGE:"token-error-message",TOKEN_ERROR_CATEGORY:"token-error-category",TOKEN_RAW_CLAIMS:"token-raw-claims",TOKEN_CLAIMS_TABLE:"token-claims-table",TOKEN_INSTRUCTIONS:"token-instructions"},JWKS_VALIDATOR:{CONTAINER:"jwks-verification-container",BUTTON_WRAPPER:"jwks-button-wrapper",VERIFY_BUTTON:"verify-jwks-button",VERIFICATION_RESULT:"verification-result"}},x={ISSUER_CONFIG_EDITOR:{DEFAULT_ISSUER_NAME:"sample-issuer",SAMPLE_ISSUER_URL:"https://sample-issuer.example.com",SAMPLE_JWKS_URL:"https://sample-issuer.example.com/.well-known/jwks.json",SAMPLE_AUDIENCE:"sample-audience",SAMPLE_CLIENT_ID:"sample-client"}},M={COMPONENT_TABS:{ISSUER_CONFIG:"jwt.validation.issuer.configuration",TOKEN_VERIFICATION:"jwt.validation.token.verification",METRICS:"jwt.validation.metrics",HELP:"jwt.validation.help"},PROCESSOR_TYPES:{MULTI_ISSUER_JWT_AUTHENTICATOR:"MultiIssuerJWTTokenAuthenticator"}},R={HELP_TEXT_KEYS:{TOKEN_LOCATION:"property.token.location.help",TOKEN_HEADER:"property.token.header.help",CUSTOM_HEADER_NAME:"property.custom.header.name.help",BEARER_TOKEN_PREFIX:"property.bearer.token.prefix.help",REQUIRE_VALID_TOKEN:"property.require.valid.token.help",JWKS_REFRESH_INTERVAL:"property.jwks.refresh.interval.help",MAXIMUM_TOKEN_SIZE:"property.maximum.token.size.help",ALLOWED_ALGORITHMS:"property.allowed.algorithms.help",REQUIRE_HTTPS_JWKS:"property.require.https.jwks.help"},PROPERTY_LABELS:{"Token Location":"property.token.location.help","Token Header":"property.token.header.help","Custom Header Name":"property.custom.header.name.help","Bearer Token Prefix":"property.bearer.token.prefix.help","Require Valid Token":"property.require.valid.token.help","JWKS Refresh Interval":"property.jwks.refresh.interval.help","Maximum Token Size":"property.maximum.token.size.help","Allowed Algorithms":"property.allowed.algorithms.help","Require HTTPS for JWKS URLs":"property.require.https.jwks.help"},I18N_KEYS:{JWT_VALIDATOR_LOADING:"jwt.validator.loading",JWT_VALIDATOR_TITLE:"jwt.validator.title",METRICS_TITLE:"jwt.validator.metrics.title",METRICS_TAB_NAME:"jwt.validator.metrics.tab.name",HELP_TITLE:"jwt.validator.help.title",HELP_TAB_NAME:"jwt.validator.help.tab.name"}},b={PATTERNS:{URL:new RegExp("^https?:\\/\\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$"),HTTPS_URL:new RegExp("^https:\\/\\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$"),SAFE_STRING:/^[a-zA-Z0-9._-]+$/},LIMITS:{ISSUER_NAME_MIN:2,ISSUER_NAME_MAX:100,AUDIENCE_MAX:500,CLIENT_ID_MAX:200,URL_MAX:2048}},y=(e,t={})=>{const s=document.createElement(e);return t.css&&(Array.isArray(t.css)?s.classList.add(...t.css):typeof t.css=="string"&&(s.className=t.css)),t.className&&(s.className=t.className),t.text&&(s.textContent=t.text),t.html&&(t.sanitized===!0?s.innerHTML=t.html:s.textContent=t.html),t.attributes&&Object.entries(t.attributes).forEach(([i,n])=>{if(i==="disabled"||i==="checked"||i==="readonly"||i==="required")if(n===!0||n==="true"||n==="")s.setAttribute(i,"");else{if(n===!1||n==="false"||n===null||n===void 0)return;s.setAttribute(i,n)}else s.setAttribute(i,n)}),t.events&&Object.entries(t.events).forEach(([i,n])=>{s.addEventListener(i,n)}),t.children&&t.children.forEach(i=>{i instanceof Element?s.appendChild(i):typeof i=="string"&&s.appendChild(document.createTextNode(i))}),s};class j{constructor(t={}){this.defaultOptions={i18n:t.i18n||{},cssClasses:t.cssClasses||h,validationEnabled:t.validationEnabled!==!1,containerClass:"form-field",labelSuffix:":",showDescriptions:t.showDescriptions!==!1}}createField(t){const{name:s,label:i,description:n,value:o="",type:r="text",required:a=!1,placeholder:l=n,validation:d=null,events:v={},cssClass:m="",helpText:p=null,disabled:u=!1,attributes:I={}}=t,f=this._createFieldContainer(s,m),C=this._createLabel(s,i,a);f.appendChild(C);const de=this._createInput(s,r,o,l,u,I);if(f.appendChild(de),this.defaultOptions.showDescriptions&&n){const ue=this._createDescription(n);f.appendChild(ue)}if(p){const ue=this._createHelpText(p);f.appendChild(ue)}this.defaultOptions.validationEnabled&&d&&this._addValidation(de,d),this._attachEventHandlers(de,v);const Ms=this._createErrorContainer(s);return f.appendChild(Ms),f}createButton(t){const{text:s,type:i="button",cssClass:n="",variant:o="primary",onClick:r=null,disabled:a=!1,icon:l=null,attributes:d={}}=t,v=["btn",`btn-${o}`,n].filter(Boolean),m={type:i,disabled:a,...d},p=y("button",{css:v,attributes:m});if(l){const u=y("i",{css:["fa",l]});p.appendChild(u),p.appendChild(document.createTextNode(" "))}return p.appendChild(document.createTextNode(s)),r&&p.addEventListener("click",r),p}createSection(t){const{title:s,content:i=[],cssClass:n="",collapsible:o=!1,expanded:r=!0}=t,a=y("div",{css:["form-section",n].filter(Boolean)});if(s){const d=y("div",{css:["form-section-header"],text:s});if(o){const v=y("i",{css:["fa",r?"fa-chevron-down":"fa-chevron-right"]});d.appendChild(v),d.addEventListener("click",()=>this._toggleSection(a)),d.style.cursor="pointer"}a.appendChild(d)}const l=y("div",{css:["form-section-content",!r&&o?"hidden":""].filter(Boolean)});return i.forEach(d=>{d instanceof Element&&l.appendChild(d)}),a.appendChild(l),a}validateContainer(t){const s=t.querySelectorAll("input, textarea, select"),i=[];let n=!0;return s.forEach(o=>{if(o._validate){const r=o._validate();r.isValid||(n=!1,i.push({field:o.name,error:r.error}))}}),{isValid:n,errors:i}}resetContainer(t){t.querySelectorAll("input, textarea, select").forEach(i=>{var o;i.value="",i.classList.remove("valid","invalid");const n=(o=i.parentElement)==null?void 0:o.querySelector(".field-error");n&&(n.classList.add("hidden"),n.textContent="")})}_createFieldContainer(t,s=""){return y("div",{css:[this.defaultOptions.containerClass,`field-container-${t}`,s].filter(Boolean)})}_createLabel(t,s,i){const n=s+this.defaultOptions.labelSuffix+(i?" *":"");return y("label",{text:n,attributes:{for:`field-${t}`},css:["field-label",i?"required":""].filter(Boolean)})}_createInput(t,s,i,n,o,r){const a={id:`field-${t}`,name:t,placeholder:n,...r};o===!0&&(a.disabled=o);const l=y(s==="textarea"?"textarea":"input",{css:[`field-${t}`,"form-input"],attributes:a});return s!=="textarea"&&l.setAttribute("type",s),i&&(s==="textarea"?l.textContent=i:l.value=i),l}_createDescription(t){return y("div",{css:["field-description"],text:t})}_createHelpText(t){return y("div",{css:["field-help","help-tooltip"],text:t,attributes:{title:t}})}_createErrorContainer(t){return y("div",{css:[`field-error-${t}`,"field-error","hidden"],attributes:{role:"alert","aria-live":"polite"}})}_addValidation(t,s){const i=()=>{const n=t.value,o=typeof s=="function"?s(n):s.validate(n),r=t.parentElement.querySelector(".field-error");return o.isValid?(t.classList.remove("invalid"),t.classList.add("valid"),r&&(r.classList.add("hidden"),r.textContent="")):(t.classList.remove("valid"),t.classList.add("invalid"),r&&(r.classList.remove("hidden"),r.textContent=o.error||"Invalid input")),o};t.addEventListener("blur",i),t.addEventListener("input",()=>{if(t.classList.contains("invalid")){t.classList.remove("invalid");const n=t.parentElement.querySelector(".field-error");n&&n.classList.add("hidden")}}),t._validate=i}_attachEventHandlers(t,s){Object.entries(s).forEach(([i,n])=>{typeof n=="function"&&t.addEventListener(i,n)})}_toggleSection(t){const s=t.querySelector(".form-section-content"),i=t.querySelector(".fa");s&&i&&(s.classList.toggle("hidden"),i.classList.toggle("fa-chevron-down"),i.classList.toggle("fa-chevron-right"))}}const lt=e=>new j().createField(e),dt=e=>new j().createButton(e),ut=e=>new j().createSection(e);class pt{static createField(t){return lt(t)}static createButton(t){return dt(t)}static createSection(t){return ut(t)}static createFactory(t){return new j(t)}}const Q=function(e,t,s){return e?{status:e.status,statusText:e.statusText||s||t||"Unknown error",responseText:e.responseText}:{status:0,statusText:"Unknown error",responseText:""}},he=q.BASE_URL,mt=()=>{if(window.jwtAuthConfig&&window.jwtAuthConfig.processorId&&window.jwtAuthConfig.apiKey)return window.jwtAuthConfig;const e=new URLSearchParams(window.location.search),t=e.get("id")||e.get("processorId"),s=e.get("apiKey");return t?(window.jwtAuthConfig={processorId:t,apiKey:s||""},window.jwtAuthConfig):{processorId:"",apiKey:""}},W=(e,t,s=null,i=!0)=>{const n={method:e,url:t};if(i&&t.includes("/jwt/")){const r=mt();n.headers={"X-API-Key":r.apiKey,"X-Processor-Id":r.processorId},s&&r.processorId&&(s.processorId=r.processorId)}s&&(n.data=JSON.stringify(s),n.contentType="application/json");const o={method:n.method||"GET",headers:n.headers||{},credentials:"same-origin"};return n.data&&(o.body=n.data,n.contentType&&(o.headers["Content-Type"]=n.contentType)),fetch(n.url,o).then(r=>r.ok?r.json():r.text().then(a=>{throw Q({status:r.status,statusText:r.statusText,responseText:a})}))},ft=e=>W("POST",`${he}/verify-token`,{token:e}).catch(t=>{throw Q(t)}),ht=()=>W("GET",`${he}/metrics`).catch(e=>{throw Q(e)}),ee=e=>W("GET",`nifi-api/processors/${e}`),ge=(e,t)=>ee(e).then(s=>{const i={revision:s.revision,component:{id:e,properties:t}};return W("PUT",`nifi-api/processors/${e}`,i)}),te=async(e,t,s,i)=>{try{await gt(e,i)}catch(n){throw typeof i=="function"&&i({validate:()=>!1,error:n.message}),n}},gt=async(e,t)=>{if(!e)throw new Error("Token verifier element is required");const s=g.getI18n()||{},i=new j({i18n:s}),n=document.createElement("div");n.className=h.TOKEN_VERIFIER.CONTAINER;const o=document.createElement("div");o.className=h.TOKEN_VERIFIER.INPUT_SECTION;const r=i.createField({name:"token-input",label:s["processor.jwt.tokenInput"]||"Enter Token",description:s["processor.jwt.tokenInputDescription"]||"Paste your JWT token for verification",placeholder:s["processor.jwt.tokenInputPlaceholder"]||"Paste token here...",type:"textarea",required:!0,cssClass:"token-verifier-field",attributes:{rows:5},disabled:!1}),a=i.createButton({text:s["processor.jwt.verifyToken"]||"Verify Token",variant:"primary",cssClass:h.TOKEN_VERIFIER.VERIFY_BUTTON,icon:"fa-check"}),l=i.createButton({text:"Clear",variant:"secondary",cssClass:"clear-token-button",icon:"fa-trash"}),d=document.createElement("div");d.className="button-container",d.appendChild(a),d.appendChild(l),o.appendChild(r),o.appendChild(d);const v=document.createElement("div");v.className=h.TOKEN_VERIFIER.RESULTS_SECTION;const m=document.createElement("h3");m.textContent=s["processor.jwt.verificationResults"]||"Verification Results";const p=document.createElement("div");p.className=h.TOKEN_VERIFIER.RESULTS_CONTENT,v.appendChild(m),v.appendChild(p),n.appendChild(o),n.appendChild(v),e.appendChild(n),a.addEventListener("click",async()=>{const u=r.querySelector("#field-token-input"),I=u?u.value.trim():"";if(!I){_(p,null,s,"processor.jwt.noTokenProvided");return}p.innerHTML=`<div class="verifying">${s["processor.jwt.verifying"]||"Verifying token..."}</div>`;try{const f=await ft(I);vt(f,p,s)}catch(f){const C=f.jqXHR||{status:f.status||500,statusText:f.statusText||"Error",responseJSON:f.responseJSON||{error:f.message||"Unknown error"}};_(p,C,s)}}),l.addEventListener("click",()=>{ct(()=>{const u=r.querySelector("#field-token-input");u&&(u.value=""),p.innerHTML=""})}),typeof t=="function"&&t({validate:()=>!0,getValue:()=>{const u=r.querySelector("#field-token-input");return u?u.value:""},setValue:u=>{const I=r.querySelector("#field-token-input");I&&(I.value=u)}})},vt=(e,t,s)=>{const i=e.valid===!0,n=i?"valid":"invalid",o=i?s["processor.jwt.tokenValid"]||"Token is valid":s["processor.jwt.tokenInvalid"]||"Token is invalid";let r=`
        <div class="verification-status ${n}">
            <i class="fa ${i?"fa-check-circle":"fa-times-circle"}"></i>
            <span>${o}</span>
        </div>
    `;if(e.decoded){if(r+='<div class="token-details">',e.decoded.header&&(r+=`
                <div class="token-section">
                    <h4>${s["processor.jwt.tokenHeader"]||"Header"}</h4>
                    <pre>${JSON.stringify(e.decoded.header,null,2)}</pre>
                </div>
            `),e.decoded.payload){r+=`
                <div class="token-section">
                    <h4>${s["processor.jwt.tokenPayload"]||"Payload"}</h4>
                    <pre>${JSON.stringify(e.decoded.payload,null,2)}</pre>
                </div>
            `;const a=e.decoded.payload;if(r+='<div class="token-claims">',a.exp){const l=new Date(a.exp*1e3),d=l<new Date;r+=`
                    <div class="claim ${d?"expired":""}">
                        <strong>${s["processor.jwt.expiration"]||"Expiration"}:</strong>
                        ${l.toLocaleString()}
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
                `),r+="</div>"}r+="</div>"}e.error&&(r+=`
            <div class="verification-error">
                <strong>${s["processor.jwt.error"]||"Error"}:</strong>
                ${e.error}
            </div>
        `),t.innerHTML=r},Et=Object.freeze(Object.defineProperty({__proto__:null,cleanup:()=>{},init:te},Symbol.toStringTag,{value:"Module"})),U=(e,t=!0)=>{const s=e==null,n=(s?"":String(e)).trim(),o=n===""||n.toLowerCase()==="null"||n.toLowerCase()==="undefined";return t&&(s||o)?{isValid:!1,error:"This field is required.",sanitizedValue:""}:{isValid:!0,sanitizedValue:n}},Tt=e=>{const t=U(e);if(!t.isValid)return{isValid:!1,error:"URL is required for processor ID extraction.",sanitizedValue:""};const s=t.sanitizedValue,n=/\/processors\/([a-f0-9-]+)/i.exec(s);return n?{isValid:!0,sanitizedValue:n[1].toLowerCase()}:{isValid:!1,error:"URL does not contain a valid processor ID.",sanitizedValue:""}},ve=(e,t={})=>{const{httpsOnly:s=!1,maxLength:i=b.LIMITS.URL_MAX}=t,n=U(e);if(!n.isValid)return{isValid:!1,error:"URL is required.",sanitizedValue:""};const o=n.sanitizedValue;return o.length>i?{isValid:!1,error:`URL is too long (maximum ${i} characters).`,sanitizedValue:o}:(s?b.PATTERNS.HTTPS_URL:b.PATTERNS.URL).test(o)?{isValid:!0,sanitizedValue:o}:{isValid:!1,error:`Invalid URL format. Must be a valid ${s?"HTTPS":"HTTP/HTTPS"} URL.`,sanitizedValue:o}},bt=e=>{const t=U(e);if(!t.isValid)return{isValid:!1,error:"Issuer name is required.",sanitizedValue:""};const s=t.sanitizedValue;return s.length<b.LIMITS.ISSUER_NAME_MIN?{isValid:!1,error:`Issuer name must be at least ${b.LIMITS.ISSUER_NAME_MIN} characters long.`,sanitizedValue:s}:s.length>b.LIMITS.ISSUER_NAME_MAX?{isValid:!1,error:`Issuer name is too long (maximum ${b.LIMITS.ISSUER_NAME_MAX} characters).`,sanitizedValue:s}:b.PATTERNS.SAFE_STRING.test(s)?{isValid:!0,sanitizedValue:s}:{isValid:!1,error:"Issuer name can only contain letters, numbers, hyphens, underscores, and dots.",sanitizedValue:s}},yt=(e,t=!1)=>{const s=U(e,t);if(!s.isValid)return s;if(!t&&s.sanitizedValue==="")return{isValid:!0,sanitizedValue:""};const i=s.sanitizedValue;return i.length>b.LIMITS.AUDIENCE_MAX?{isValid:!1,error:`Audience is too long (maximum ${b.LIMITS.AUDIENCE_MAX} characters).`,sanitizedValue:i}:{isValid:!0,sanitizedValue:i}},It=(e,t=!1)=>{const s=U(e,t);if(!s.isValid)return s;if(!t&&s.sanitizedValue==="")return{isValid:!0,sanitizedValue:""};const i=s.sanitizedValue;return i.length>b.LIMITS.CLIENT_ID_MAX?{isValid:!1,error:`Client ID is too long (maximum ${b.LIMITS.CLIENT_ID_MAX} characters).`,sanitizedValue:i}:{isValid:!0,sanitizedValue:i}},wt=e=>{const t=[],s={},i=bt(e.issuerName);i.isValid||t.push(`Issuer Name: ${i.error}`),s.issuerName=i.sanitizedValue;const n=ve(e.issuer,{httpsOnly:!1});n.isValid||t.push(`Issuer URI: ${n.error}`),s.issuer=n.sanitizedValue;const o=ve(e["jwks-url"],{httpsOnly:!1});o.isValid||t.push(`JWKS URL: ${o.error}`),s["jwks-url"]=o.sanitizedValue;const r=yt(e.audience,!1);r.isValid||t.push(`Audience: ${r.error}`),s.audience=r.sanitizedValue;const a=It(e["client-id"],!1);return a.isValid||t.push(`Client ID: ${a.error}`),s["client-id"]=a.sanitizedValue,t.length>0?{isValid:!1,error:t.join(" "),sanitizedValue:s}:{isValid:!0,sanitizedValue:s}};class St{constructor(t){this.componentId=t,this.initialized=!1,this.timeouts=new Set}async initialize(t){try{t&&await t(),this.initialized=!0}catch(s){console.debug(s)}}isComponentInitialized(){return this.initialized}setTimeout(t,s){const i=setTimeout(()=>{this.timeouts.delete(i),t()},s);return this.timeouts.add(i),i}destroy(){this.timeouts.forEach(clearTimeout),this.timeouts.clear(),this.initialized=!1}}const E=O.getI18n()||{};let V=null;const se=()=>({name:x.ISSUER_CONFIG_EDITOR.DEFAULT_ISSUER_NAME,properties:{issuer:x.ISSUER_CONFIG_EDITOR.SAMPLE_ISSUER_URL,"jwks-url":x.ISSUER_CONFIG_EDITOR.SAMPLE_JWKS_URL,audience:x.ISSUER_CONFIG_EDITOR.SAMPLE_AUDIENCE,"client-id":x.ISSUER_CONFIG_EDITOR.SAMPLE_CLIENT_ID}}),Lt=e=>`<span class="success-message">${e}</span>`,kt=(e,t=!1)=>{const s=E["processor.jwt.ok"]||"OK",i=E["processor.jwt.validJwks"]||"Valid JWKS",n=E["processor.jwt.keysFound"]||"keys found",o=t?" <em>(Simulated response)</em>":"";return`${Lt(s)} ${i} (${e} ${n})${o}`},Ee=e=>{const t={};return Object.entries(e).filter(([s])=>s.startsWith("issuer.")).forEach(([s,i])=>{const n=s.slice(7).split(".");if(n.length===2){const[o,r]=n;t[o]||(t[o]={}),t[o][r]=i}}),t},Ct=e=>{var t,s;return((s=(t=e==null?void 0:e[0])==null?void 0:t.value)==null?void 0:s.trim())||""},Te=e=>{const t=s=>{const i=e.querySelector(s);return i?i.value.trim():""};return{issuerName:t(".issuer-name"),issuer:t(".field-issuer"),"jwks-url":t(".field-jwks-url"),audience:t(".field-audience"),"client-id":t(".field-client-id")}},_t=()=>document.querySelector(".global-error-messages"),Rt=e=>{const t=document.createElement("div");t.className="issuer-config-editor",e.appendChild(t);const s=E["Jwt.Validation.Issuer.Configuration"]||"Issuer Configurations",i=document.createElement("h3");i.textContent=s,t.appendChild(i);const n=E["issuer.config.description"]||"Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.",o=document.createElement("p");o.textContent=n,t.appendChild(o);const r=document.createElement("div");r.className="global-error-messages issuer-form-error-messages",r.style.display="none",t.appendChild(r);const a=document.createElement("div");return a.className="issuers-container",t.appendChild(a),{container:t,issuersContainer:a,globalErrorContainer:r}},At=(e,t,s=null)=>{const i=document.createElement("button");i.className="add-issuer-button",i.textContent="Add Issuer",e.appendChild(i);const n=()=>{const o=se();D(t,o.name+"-"+Date.now(),o.properties,s)};i.addEventListener("click",n)},Ot=async(e,t)=>{const s=P(e);await xt(t,s)},Nt=async(e,t)=>{const s=P(t),{container:i,issuersContainer:n}=Rt(e);At(i,n,s),await Ot(t,n)},P=e=>{const t=Tt(e);return t.isValid?t.sanitizedValue:""},xt=async(e,t)=>{if(!t){const s=se();D(e,s.name,s.properties,t);return}try{const i=(await ee(t)).properties||{},n=Ee(i);Object.keys(n).forEach(o=>{D(e,o,n[o],t)})}catch(s){console.debug(s);const i=se();D(e,i.name,i.properties,t)}},Mt=(e,t)=>{const s=document.createElement("div");s.className="form-header";const i=document.createElement("label");i.textContent="Issuer Name:",s.appendChild(i);const n=document.createElement("input");n.type="text",n.className="issuer-name",n.placeholder="e.g., keycloak",n.title="Unique identifier for this issuer configuration. Use alphanumeric characters and hyphens only.",i.appendChild(n),e&&(n.value=e);const o=document.createElement("button");o.className="remove-issuer-button",o.title="Delete this issuer configuration",o.textContent="Remove",s.appendChild(o);const r=async()=>{const a=n.value||"Unnamed Issuer";await at(a,()=>{t(a)})};return o.addEventListener("click",r),s},jt=()=>{const e=document.createElement("div");e.className="jwks-button-wrapper";const t=document.createElement("button");t.type="button",t.className="verify-jwks-button",t.title="Test connectivity to the JWKS endpoint and verify it returns valid keys",t.textContent="Test Connection";const s=`<em>${E["jwksValidator.initialInstructions"]||"Click the button to validate JWKS"}</em>`,i=document.createElement("div");return i.className="verification-result",i.innerHTML=s,e.appendChild(t),e.appendChild(i),{testButtonWrapper:e,testButton:t,resultContainer:i}},Ut=(e,t)=>{const s=e.querySelector(".field-jwks-url"),i=s?s.closest(".form-field"):null;i?i.insertAdjacentElement("afterend",t):e.appendChild(t)},be=(e,t)=>{t.valid?e.innerHTML=kt(t.keyCount):_(e,{responseJSON:t},E,"processor.jwt.invalidJwks")},ie=(e,t,s)=>{_(e,t,E,"processor.jwt.validationError")},ye=(e,t)=>{try{return fetch(q.ENDPOINTS.JWKS_VALIDATE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jwksValue:e}),credentials:"same-origin"}).then(s=>s.ok?s.json():s.text().then(i=>{const n=new Error(`HTTP ${s.status}: ${s.statusText}`);n.status=s.status,n.statusText=s.statusText,n.responseText=i;try{n.responseJSON=JSON.parse(i)}catch{}throw n})).then(s=>be(t,s)).catch(s=>ie(t,s,!0))}catch(s){return ie(t,s),Promise.reject(s)}},Vt=(e,t)=>{const{testButtonWrapper:s,testButton:i,resultContainer:n}=jt();Ut(e,s);const o=()=>{n.innerHTML=E["processor.jwt.testing"]||"Testing...";const r=t();ye(r,n)};i.addEventListener("click",o)},Pt=(e,t=null)=>{const s=t?"Save this issuer configuration to the NiFi processor":"Validate and save this issuer configuration (standalone mode)",i=document.createElement("button");i.className="save-issuer-button",i.title=s,i.textContent="Save Issuer";const n=document.createElement("div");n.className="issuer-form-error-messages";const o=()=>{n.innerHTML="",ke(e,n,t)};return i.addEventListener("click",o),e.appendChild(n),i},Dt=(e,t)=>{$(e,"issuer","Issuer URI","The URI of the token issuer (must match the iss claim)",t?t.issuer:"",'This value must exactly match the "iss" claim in JWT tokens. Example: https://auth.example.com/auth/realms/myrealm'),$(e,"jwks-url","JWKS URL","The URL of the JWKS endpoint",t?t["jwks-url"]:"","URL providing public keys for JWT signature verification. Usually ends with /.well-known/jwks.json"),Vt(e,()=>{const s=e.querySelector(".field-jwks-url");return s?s.value:""}),$(e,"audience","Audience","The expected audience claim value",t?t.audience:"",'Optional: Expected "aud" claim value in JWT tokens. Leave blank to accept any audience.'),$(e,"client-id","Client ID","The client ID for token validation",t?t["client-id"]:"",'Optional: Expected "azp" or "client_id" claim value. Used for additional token validation.')},$t=(e,t,s=null)=>{const i=document.createElement("div");i.className="issuer-form";const n=Mt(e,a=>{Re(i,a)});i.appendChild(n);const o=document.createElement("div");o.className="form-fields",i.appendChild(o),Dt(o,t);const r=Pt(i,s);return i.appendChild(r),i},D=(e,t,s,i=null)=>{const n=$t(t,s,i);e.appendChild(n)},$=(e,t,s,i,n,o)=>{const r={name:t,label:s,description:i,value:n||"",placeholder:i,type:"text",required:!1,cssClass:"issuer-config-field",helpText:o||null,validation:t==="jwks-url"||t==="issuer"?l=>l!=null&&l.trim()?{isValid:!0}:{isValid:!1,error:"This field is required"}:null},a=pt.createField(r);e.appendChild(a)},Ie=e=>{if(!e.issuerName)return{isValid:!1,error:new Error(E["issuerConfigEditor.error.issuerNameRequired"]||"Issuer name is required.")};const s={issuer:e.issuer,"jwks-url":e["jwks-url"],audience:e.audience,"client-id":e["client-id"]};if(!s.issuer||!s["jwks-url"])return{isValid:!1,error:new Error(E["issuerConfigEditor.error.requiredFields"]||"Issuer URI and JWKS URL are required.")};const i=wt(e);return i.isValid||console.debug("Enhanced validation warnings:",i.error),{isValid:!0}},we=(e,t)=>{const s={issuer:t.issuer,"jwks-url":t["jwks-url"],audience:t.audience,"client-id":t["client-id"]},i={};return Object.keys(s).forEach(n=>{s[n]&&(i[`issuer.${e}.${n}`]=s[n])}),i},Se=async(e,t,s,i)=>{try{await ge(e,s),Z(i,E["issuerConfigEditor.success.saved"]||"Issuer configuration saved successfully.")}catch(n){_(i,n,E,"issuerConfigEditor.error.saveFailedTitle")}},Le=e=>{Z(e,E["issuerConfigEditor.success.savedStandalone"]||"Issuer configuration saved successfully (standalone mode).")},ke=async(e,t,s=null)=>{t.innerHTML="";const i=Te(e),n=Ie(i);if(!n.isValid){_(t,n.error,E,"issuerConfigEditor.error.title");return}const o=i.issuerName,r=we(o,i);s?await Se(s,o,r,t):Le(t)},Ht=(e,t)=>{const s={};return Object.keys(e).forEach(i=>{i.startsWith(`issuer.${t}.`)&&(s[i]=null)}),s},Ce=(e,t,s=!1)=>{if(!e)return;const i=s?`Issuer "${t}" removed (standalone mode).`:`Issuer "${t}" removed successfully.`;Z(e,i),e.style.display="block"},_e=(e,t)=>{if(e){const s=typeof t=="string"?new Error(t):t;_(e,s,E,"issuerConfigEditor.error.removeFailedTitle"),e.style.display="block"}else{const s=typeof t=="string"?t:t.message;console.error("Failed to remove issuer:",s)}},Bt=async(e,t,s)=>{try{const n=(await ee(e)).properties||{},o=Ht(n,t);if(Object.keys(o).length===0&&t!=="sample-issuer"){console.info(`No properties found to remove for issuer: ${t}`);return}await ge(e,o),Ce(s,t,!1)}catch(i){_e(s,i)}},Re=async(e,t)=>{e.remove();const s=P(window.location.href),i=t,n=_t();i&&s?await Bt(s,i,n):i&&!s?Ce(n,i,!0):_e(n,i?"Cannot remove issuer: no processor context found":"Issuer name missing for removal")},Ft=(e,t)=>e?!0:(typeof t=="function"&&t(),!1),zt=()=>window.location.href,Jt=e=>{const s=`issuer-config-editor-${P(e)||"standalone"}`;setTimeout(()=>{V=new St(s),V.initialize(async()=>{})},0)},Ae=e=>{typeof e=="function"&&e()},ne=async(e,t)=>{if(Ft(e,t))try{const s=zt();Jt(s),await Nt(e,s),Ae(t)}catch(s){console.debug(s),Ae(t)}},qt=Object.freeze(Object.defineProperty({__proto__:null,__test_exports:{saveIssuer:ke,removeIssuer:Re,addIssuerForm:D,addFormField:$,getProcessorIdFromUrl:P,_parseIssuerProperties:Ee,_extractFieldValue:Ct,_extractFormFields:Te,_validateIssuerFormData:Ie,_createPropertyUpdates:we,_saveIssuerToServer:Se,_saveIssuerStandalone:Le,_handleJwksValidationResponse:be,_handleJwksValidationError:ie,_performJwksValidation:ye},cleanup:()=>{V&&(V.destroy(),V=null)},init:ne},Symbol.toStringTag,{value:"Module"})),Wt=function(e){if(!e)return"";try{const t=new Date(e);return isNaN(t.getTime())?(e!=="not-a-date"&&console.warn(`Invalid date format: ${e}`),e):t.toLocaleString()}catch(t){return console.warn(`Error formatting date: ${e}`,t),window._formattersErrors===void 0&&(window._formattersErrors=[]),window._formattersErrors.push({function:"formatDate",input:e,error:t.message,timestamp:new Date().toISOString()}),e}},K=function(e){return e==null?"":new Intl.NumberFormat("en-US").format(e)},T=z("MetricsTab"),oe=e=>(e*100).toFixed(1)+"%",Oe=e=>Wt(e),re=()=>{T.info("Initializing metrics tab"),document.getElementById("jwt-metrics-content")?T.debug("Metrics tab content already exists, skipping creation"):(T.info("Creating metrics tab content..."),Kt(),Gt())},Kt=()=>{const e=`
        <div id="jwt-metrics-content" class="jwt-tab-content" data-testid="metrics-tab-content">
            <div class="metrics-header">
                <h3>${g.getI18n().getProperty(R.I18N_KEYS.METRICS_TITLE)||"JWT Validation Metrics"}</h3>
                <div class="metrics-actions">
                    <button id="refresh-metrics-btn" class="btn btn-small" 
                    data-testid="refresh-metrics-button">
                        <i class="fa fa-refresh"></i> Refresh
                    </button>
                    <button id="export-metrics-btn" class="btn btn-small" 
                    data-testid="export-metrics-button">
                        <i class="fa fa-download"></i> Export
                    </button>
                </div>
            </div>
            
            <div class="metrics-summary" data-testid="validation-metrics">
                <h4>Validation Metrics</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h5>Total Validations</h5>
                        <div class="metric-value" id="total-validations" data-testid="total-validations">0</div>
                    </div>
                    <div class="metric-card">
                        <h5>Success Rate</h5>
                        <div class="metric-value" id="success-rate" data-testid="success-rate">0%</div>
                    </div>
                    <div class="metric-card">
                        <h5>Failure Rate</h5>
                        <div class="metric-value" id="failure-rate" data-testid="failure-rate">0%</div>
                    </div>
                    <div class="metric-card">
                        <h5>Active Issuers</h5>
                        <div class="metric-value" id="active-issuers">0</div>
                    </div>
                </div>
            </div>
            
            <div class="performance-metrics" data-testid="performance-metrics">
                <h4>Performance Metrics</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h5>Average Response Time</h5>
                        <div class="metric-value" id="avg-response-time" data-testid="avg-response-time">0 ms</div>
                    </div>
                    <div class="metric-card">
                        <h5>Min Response Time</h5>
                        <div class="metric-value" id="min-response-time" data-testid="min-response-time">0 ms</div>
                    </div>
                    <div class="metric-card">
                        <h5>Max Response Time</h5>
                        <div class="metric-value" id="max-response-time" data-testid="max-response-time">0 ms</div>
                    </div>
                    <div class="metric-card">
                        <h5>P95 Response Time</h5>
                        <div class="metric-value" id="p95-response-time" data-testid="p95-response-time">0 ms</div>
                    </div>
                </div>
            </div>
            
            <div class="issuer-metrics" data-testid="issuer-metrics">
                <h4>Issuer-Specific Metrics</h4>
                <div class="issuer-metrics-container">
                    <table class="issuer-metrics-table" data-testid="issuer-metrics-table">
                        <thead>
                            <tr>
                                <th>Issuer</th>
                                <th>Total Requests</th>
                                <th>Success</th>
                                <th>Failed</th>
                                <th>Success Rate</th>
                                <th>Avg Response Time</th>
                            </tr>
                        </thead>
                        <tbody id="issuer-metrics-list">
                            <tr>
                                <td colspan="6" class="metrics-loading">Loading metrics...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="error-metrics" data-testid="error-metrics">
                <h4>Recent Errors</h4>
                <div id="error-metrics-list" class="metrics-list">
                    <div class="no-errors">No recent errors</div>
                </div>
            </div>
            
            <div class="metrics-footer">
                <span class="last-updated" data-testid="last-updated">Last updated: Never</span>
                <span class="refresh-indicator" data-testid="refresh-indicator" style="display:none;">
                    <i class="fa fa-spinner fa-spin"></i> Refreshing...
                </span>
            </div>
            
            <div id="export-options" class="export-options" data-testid="export-options" style="display:none;">
                <h5>Export Format:</h5>
                <button class="btn btn-small" data-testid="export-csv">CSV</button>
                <button class="btn btn-small" data-testid="export-json">JSON</button>
                <button class="btn btn-small" data-testid="export-prometheus">Prometheus</button>
            </div>
        </div>
    `,t=document.getElementById("metrics");if(T.info("Metrics tab pane found:",!!t),t)T.info("Appending metrics content to tab pane"),t.innerHTML=e,T.info("Metrics content appended, new length:",t.innerHTML.length);else{T.warn("Metrics tab pane not found, appending to container");const o=document.getElementById("jwt-validator-container");o&&o.insertAdjacentHTML("beforeend",e)}const s=document.getElementById("refresh-metrics-btn");s&&s.addEventListener("click",Yt);const i=document.getElementById("export-metrics-btn");i&&i.addEventListener("click",Xt);const n=document.getElementById("export-options");n&&n.addEventListener("click",o=>{if(o.target.matches('[data-testid^="export-"]')){const r=o.target.getAttribute("data-testid").replace("export-","");Zt(r),n.style.display="none"}})};let A=null,Ne=!0;const Gt=()=>{G(),typeof jest>"u"&&(A=setInterval(G,1e4))},Yt=async()=>{const e=document.querySelector('[data-testid="refresh-indicator"]');e&&(e.style.display="inline-block"),await G(),e&&setTimeout(()=>{e.style.display="none"},500)},Xt=()=>{const e=document.getElementById("export-options");e&&(e.style.display=e.style.display==="none"?"block":"none")},Zt=e=>{T.info(`Exporting metrics in ${e} format`)},G=async()=>{if(T.debug("Refreshing metrics"),!Ne){T.debug("Metrics endpoint not available, skipping refresh");return}try{const e=await Qt();es(e),ts()}catch(e){T.error("Failed to refresh metrics:",e),ss()}},Qt=async()=>{try{const e=await ht(),t=e.totalTokensValidated||0,s=e.validTokens||0,i=e.invalidTokens||0;return{totalValidations:t,successCount:s,failureCount:i,avgResponseTime:e.averageResponseTime||0,minResponseTime:e.minResponseTime||0,maxResponseTime:e.maxResponseTime||0,p95ResponseTime:e.p95ResponseTime||0,activeIssuers:e.activeIssuers||0,issuerMetrics:e.issuerMetrics||[],recentErrors:e.topErrors||[]}}catch(e){return T.error("Failed to fetch metrics from API:",e),e.status===404&&(T.info("Metrics endpoint not available (404), showing placeholder data"),Ne=!1,is()),{totalValidations:0,successCount:0,failureCount:0,avgResponseTime:0,minResponseTime:0,maxResponseTime:0,p95ResponseTime:0,activeIssuers:0,issuerMetrics:[],recentErrors:[]}}},es=e=>{const t=document.getElementById("total-validations");t&&(t.textContent=K(e.totalValidations));const s=e.totalValidations>0?e.successCount/e.totalValidations:0,i=e.totalValidations>0?e.failureCount/e.totalValidations:0,n=document.getElementById("success-rate");n&&(n.textContent=oe(s));const o=document.getElementById("failure-rate");o&&(o.textContent=oe(i));const r=document.getElementById("avg-response-time");r&&(r.textContent=`${e.avgResponseTime||0} ms`);const a=document.getElementById("min-response-time");a&&(a.textContent=`${e.minResponseTime||0} ms`);const l=document.getElementById("max-response-time");l&&(l.textContent=`${e.maxResponseTime||0} ms`);const d=document.getElementById("p95-response-time");d&&(d.textContent=`${e.p95ResponseTime||0} ms`);const v=document.getElementById("active-issuers");if(v&&(v.textContent=e.activeIssuers),e.issuerMetrics&&e.issuerMetrics.length>0){const m=e.issuerMetrics.map(u=>`
            <tr data-testid="issuer-metrics-row">
                <td data-testid="issuer-name">${u.name}</td>
                <td>${K(u.totalRequests||u.validations||0)}</td>
                <td>${K(u.successCount||0)}</td>
                <td>${K(u.failureCount||0)}</td>
                <td>${oe((u.successRate||0)/100)}</td>
                <td>${u.avgResponseTime||0} ms</td>
            </tr>
        `).join(""),p=document.getElementById("issuer-metrics-list");p&&(p.innerHTML=m)}else{const m=document.getElementById("issuer-metrics-list");m&&(m.innerHTML='<tr><td colspan="6" class="no-data">No issuer data available</td></tr>')}if(e.recentErrors&&e.recentErrors.length>0){const m=e.recentErrors.map(u=>`
            <div class="error-metric-item">
                <div class="error-details">
                    <span class="error-issuer">${u.issuer||"Unknown"}</span>
                    <span class="error-message">${u.error}</span>
                    <span class="error-count">(${u.count} occurrences)</span>
                </div>
                <div class="error-time">${Oe(u.timestamp)}</div>
            </div>
        `).join(""),p=document.getElementById("error-metrics-list");p&&(p.innerHTML=m)}else{const m=document.getElementById("error-metrics-list");m&&(m.innerHTML='<div class="no-errors">No recent errors</div>')}},ts=()=>{const e=document.querySelector('[data-testid="last-updated"]');e&&(e.textContent=`Last updated: ${Oe(new Date)}`)},ss=()=>{const e=document.getElementById("jwt-metrics-content");e&&(e.innerHTML=`
            <div class="metrics-error">
                <i class="fa fa-exclamation-triangle"></i>
                <p>Unable to load metrics. Please try again later.</p>
                <button onclick="location.reload()">Reload Page</button>
            </div>
        `)},is=()=>{const e=document.getElementById("jwt-metrics-content");e&&(e.innerHTML=`
            <div class="metrics-not-available">
                <i class="fa fa-info-circle"></i>
                <h3>Metrics Not Available</h3>
                <p>The metrics endpoint is not currently implemented.</p>
                <p>Metrics functionality will be available in a future release.</p>
            </div>
        `),A&&(clearInterval(A),A=null)},ns=()=>{T.debug("Cleaning up metrics tab"),A&&(clearInterval(A),A=null)},os=()=>g.getI18n().getProperty(R.I18N_KEYS.METRICS_TAB_NAME)||"Metrics";window.metricsTab={refreshMetrics:G};const rs=Object.freeze(Object.defineProperty({__proto__:null,cleanup:ns,getDisplayName:os,init:re},Symbol.toStringTag,{value:"Module"})),L=z("HelpTab"),ae=()=>{L.info("Initializing help tab"),document.getElementById("jwt-help-content")?L.info("Help tab content already exists, skipping creation"):(L.info("Creating help tab content..."),as(),cs())},as=()=>{const e=`
        <div id="jwt-help-content" class="jwt-tab-content help-tab" data-testid="help-tab-content">
            <div class="help-header">
                <h3>${g.getI18n().getProperty(R.I18N_KEYS.HELP_TITLE)||"JWT Authenticator Help"}</h3>
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
    `,t=document.getElementById("help");if(L.info("Help tab pane found:",!!t),t)L.info("Appending help content to tab pane"),t.innerHTML=e,L.info("Help content appended, new length:",t.innerHTML.length);else{L.warn("Help tab pane not found, appending to container");const s=document.getElementById("jwt-validator-container");s&&s.insertAdjacentHTML("beforeend",e)}},cs=()=>{document.querySelectorAll(".collapsible-header").forEach(e=>{e.addEventListener("click",function(){const t=this.nextElementSibling,s=this.querySelector("i.fa");this.classList.toggle("active"),t&&t.classList.contains("collapsible-content")&&t.classList.toggle("show"),s&&(this.classList.contains("active")?(s.classList.remove("fa-chevron-right"),s.classList.add("fa-chevron-down")):(s.classList.remove("fa-chevron-down"),s.classList.add("fa-chevron-right"))),L.debug("Toggled help section:",this.textContent.trim())})})},ls=Object.freeze(Object.defineProperty({__proto__:null,cleanup:()=>{L.debug("Cleaning up help tab")},getDisplayName:()=>g.getI18n().getProperty(R.I18N_KEYS.HELP_TAB_NAME)||"Help",init:ae},Symbol.toStringTag,{value:"Module"}));let xe="en";const Me=["en","de"],ds=function(){const t=(navigator.language||navigator.userLanguage||"en").split("-")[0];return Me.includes(t)?t:"en"},us=function(e){return Me.includes(e)?(xe=e,!0):!1},ps=function(){return xe};us(ds());function H(e,t={},s=document){var r;if(e==null)return null;let i;if(typeof e=="string"?i=s.querySelectorAll(e):Array.isArray(e)?i=e:i=[e],i.length===0)return null;const o={...{placement:"bottom-start",arrow:!0,theme:"light-border",appendTo:"parent"},...t};try{return Ge(Array.from(i),o)}catch(a){return(r=g==null?void 0:g.logError)==null||r.call(g,"Error initializing tooltip: "+a.message),null}}const ms={"ctrl+enter":"verify-token","cmd+enter":"verify-token","alt+v":"verify-token","ctrl+1":"goto-tab-1","ctrl+2":"goto-tab-2","ctrl+3":"goto-tab-3","cmd+1":"goto-tab-1","cmd+2":"goto-tab-2","cmd+3":"goto-tab-3","ctrl+s":"save-form","cmd+s":"save-form","alt+r":"reset-form",escape:"close-dialog",f1:"show-help","?":"show-help"},je=new Map,Ue=()=>{De(),document.addEventListener("keydown",Ve),window.__keyboardShortcutHandler=Ve,Is()},Ve=e=>{const t=Pe(e),s=ms[t];s&&fs(e)&&(e.preventDefault(),e.stopPropagation(),hs(s))},Pe=e=>{const t=[];(e.ctrlKey||e.metaKey)&&t.push(e.ctrlKey?"ctrl":"cmd"),e.altKey&&t.push("alt"),e.shiftKey&&t.push("shift");const s=e.key?e.key.toLowerCase():"";return s==="enter"?t.push("enter"):s==="escape"?t.push("escape"):s==="f1"?t.push("f1"):s&&s.match(/^[a-z0-9?]$/)&&t.push(s),t.join("+")},fs=e=>{const t=e.target,s=t.tagName?t.tagName.toLowerCase():"";if(s==="input"||s==="textarea"){const i=Pe(e);return i==="ctrl+enter"||i==="cmd+enter"||i==="escape"}return!0},hs=e=>{if(e!=null&&e.startsWith("custom-")){const t=je.get(e);if(t&&t.handler){t.handler();return}}switch(e){case"verify-token":gs();break;case"goto-tab-1":case"goto-tab-2":case"goto-tab-3":vs(parseInt(e.split("-")[2])-1);break;case"save-form":Es();break;case"reset-form":Ts();break;case"close-dialog":bs();break;case"show-help":ys();break;default:console.debug("Unknown keyboard shortcut action:",e)}},gs=()=>{const e=document.querySelector(".verify-token-button:not(:disabled)");e&&e.offsetParent!==null&&(e.click(),B("Token verification started"))},vs=e=>{const t=document.querySelectorAll(".tab-nav-item");t.length>e&&(t[e].click(),B(`Switched to tab ${e+1}`))},Es=()=>{const t=Array.from(document.querySelectorAll("button:not(:disabled)")).find(s=>s.offsetParent!==null&&(s.textContent.includes("Save")||s.textContent.includes("Apply")));t&&(t.click(),B("Form save triggered"))},Ts=()=>{const t=Array.from(document.querySelectorAll("button:not(:disabled)")).find(s=>s.offsetParent!==null&&(s.textContent.includes("Reset")||s.textContent.includes("Clear")));t&&(t.click(),B("Form reset triggered"))},bs=()=>{const e=document.querySelector(".ui-dialog-titlebar-close")||Array.from(document.querySelectorAll("button")).find(t=>t.offsetParent!==null&&(t.textContent.includes("Cancel")||t.textContent.includes("Close")));e&&(e.click(),B("Dialog closed"))},ys=()=>{const t=`
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
    `,s=document.createElement("div");s.innerHTML=t;const i=s.firstElementChild;document.body.appendChild(i);const n=()=>i.remove();i.querySelector(".close-help-btn").addEventListener("click",n),i.querySelector(".modal-overlay").addEventListener("click",n)},B=e=>{const t=document.createElement("div");t.className="keyboard-action-feedback",t.textContent=e,document.body.appendChild(t),setTimeout(()=>{t.classList.add("fade-out"),setTimeout(()=>t.remove(),300)},2e3)},Is=()=>{sessionStorage.getItem("nifi-jwt-shortcuts-shown")||setTimeout(()=>{const e=`
            <div class="shortcuts-hint">
                <span>💡 Press <kbd>F1</kbd> or <kbd>?</kbd> for keyboard shortcuts</span>
                <button class="close-hint">×</button>
            </div>
        `,t=document.createElement("div");t.innerHTML=e;const s=t.firstElementChild;document.body.appendChild(s),s.querySelector(".close-hint").addEventListener("click",()=>s.remove()),setTimeout(()=>{s.classList.add("fade-out"),setTimeout(()=>s.remove(),300)},5e3),sessionStorage.setItem("nifi-jwt-shortcuts-shown","true")},2e3)},De=()=>{window.__keyboardShortcutHandler&&(document.removeEventListener("keydown",window.__keyboardShortcutHandler),delete window.__keyboardShortcutHandler),je.clear(),document.querySelectorAll(".keyboard-shortcuts-modal, .keyboard-action-feedback, .shortcuts-hint").forEach(e=>e.remove())},ce=z("tabManager"),$e=()=>{ce.debug("Initializing tab manager");const e=new WeakMap,t=s=>{const i=s.target.closest(".jwt-tabs-header .tabs a"),n=s.target.closest('[data-toggle="tab"]'),o=i||n;if(!o||(s.preventDefault(),n&&e.get(o)))return;n&&(e.set(o,!0),setTimeout(()=>e.delete(o),100));const r=o.getAttribute("href")||o.getAttribute("data-target");if(!r||r==="#")return;document.querySelectorAll(".jwt-tabs-header .tabs li").forEach(l=>l.classList.remove("active")),o.parentElement&&o.parentElement.classList.add("active"),document.querySelectorAll(".tab-pane").forEach(l=>l.classList.remove("active"));const a=document.querySelector(r);a&&a.classList.add("active"),ce.debug("Switched to tab:",r),document.dispatchEvent(new CustomEvent("tabChanged",{detail:{tabId:r,tabName:o.textContent.trim()}}))};document.addEventListener("click",t),window.__tabClickHandler=t},ws=()=>{window.__tabClickHandler&&(document.removeEventListener("click",window.__tabClickHandler),delete window.__tabClickHandler),ce.debug("Tab manager cleaned up")},c=z("NiFi-Main"),Ss=()=>{try{ps();const e=window.location.href.includes("nifi-cuioss-ui")||window.location.href.includes("localhost:9095")||window.location.pathname.includes("/nifi-cuioss-ui");return typeof g.registerCustomUiTab=="function"&&!e?(g.registerCustomUiTab(M.COMPONENT_TABS.ISSUER_CONFIG,qt),g.registerCustomUiTab(M.COMPONENT_TABS.TOKEN_VERIFICATION,Et),g.registerCustomUiTab(M.COMPONENT_TABS.METRICS,rs),g.registerCustomUiTab(M.COMPONENT_TABS.HELP,ls)):c.info("Skipping tab registration in standalone mode"),window.jwtComponentsRegistered=!0,!0}catch(e){return console.error("JWT UI component registration failed:",e),!1}},He=()=>{try{document.querySelectorAll(h.SELECTORS.PROPERTY_LABEL).forEach(e=>{const t=e.textContent.trim(),s=R.PROPERTY_LABELS[t];if(s&&!e.querySelector(h.SELECTORS.HELP_TOOLTIP)){const i=g.getI18n().getProperty(s);if(i){const n=document.createElement("span");n.className=`${h.CLASSES.HELP_TOOLTIP} ${h.CLASSES.FA} ${h.CLASSES.FA_QUESTION_CIRCLE}`,n.setAttribute("title",i),e.appendChild(n)}}}),H(h.SELECTORS.HELP_TOOLTIP),H("[title]",{placement:"bottom"}),H(".help-tooltip",{placement:"right"}),ks(),Ls()}catch(e){c.debug("JWT UI help tooltips setup failed:",e)}},Ls=()=>{if(typeof MutationObserver<"u"){const t=new MutationObserver(s=>{let i=!1;s.forEach(n=>{n.type==="childList"&&n.addedNodes.forEach(o=>{var r;if(o.nodeType===Node.ELEMENT_NODE){const a=((r=o.textContent)==null?void 0:r.trim())||"";(a.includes("Loading JWT")||a.includes("Loading Validator")||a.includes("Loading JWT Validator UI"))&&(i=!0)}})}),i&&(c.debug("MutationObserver detected loading message, hiding immediately"),k())});t.observe(document.body,{childList:!0,subtree:!0,characterData:!0}),window.jwtLoadingObserver=t}const e=setInterval(()=>{var s,i;((i=(s=document.querySelector("*"))==null?void 0:s.innerText)==null?void 0:i.includes("Loading JWT Validator UI"))&&(c.debug("Periodic check detected loading message, hiding immediately"),k())},100);setTimeout(()=>{clearInterval(e),c.debug("Periodic loading check completed")},1e4),c.debug("Continuous loading monitoring set up successfully")},ks=()=>{try{const e=new MutationObserver(t=>{t.forEach(s=>{s.type==="childList"&&s.addedNodes.forEach(i=>{if(i.nodeType===Node.ELEMENT_NODE){const n=i.querySelectorAll("[title]"),o=i.querySelectorAll(".help-tooltip");n.length>0&&H(Array.from(n),{placement:"bottom"}),o.length>0&&H(Array.from(o),{placement:"right"})}})})});e.observe(document.body,{childList:!0,subtree:!0}),window.nifiJwtTooltipObserver||(window.nifiJwtTooltipObserver=e)}catch(e){console.debug("Failed to setup tooltip observer:",e)}},Y=()=>{try{const e=document.getElementById(h.IDS.LOADING_INDICATOR);if(e)e.style.display="none",e.style.visibility="hidden",e.setAttribute("aria-hidden","true"),e.classList.add("hidden"),e.style.removeProperty&&(e.style.removeProperty("display"),e.style.display="none"),c.debug("Loading indicator successfully hidden");else{const s=document.querySelector('#loading-indicator, .loading-indicator, [id*="loading"]');s&&(s.style.display="none",s.style.visibility="hidden")}const t=document.getElementById(h.IDS.JWT_VALIDATOR_TABS);t&&(t.style.display="",t.style.visibility="visible"),le(),window.jwtUISetupComplete=!0}catch(e){console.error("Error in setupUI():",e);try{const t=document.getElementById("loading-indicator");t&&(t.style.display="none")}catch(t){console.error("Even fallback setupUI failed:",t)}}},le=()=>{const e=g.getI18n(),t=document.getElementById(h.IDS.LOADING_INDICATOR);t&&(t.textContent=e.getProperty(R.I18N_KEYS.JWT_VALIDATOR_LOADING)||"Loading...");const s=document.querySelector(h.SELECTORS.JWT_VALIDATOR_TITLE);s&&(s.textContent=e.getProperty(R.I18N_KEYS.JWT_VALIDATOR_TITLE)||"JWT Validator")},Cs=()=>{document.addEventListener("dialogOpen",e=>{var n;const t=e.detail,s=Array.isArray(t)?t[0]:t;((n=s==null?void 0:s.classList)==null?void 0:n.contains(h.CLASSES.PROCESSOR_DIALOG))&&setTimeout(()=>{var r,a;const o=(a=(r=s.querySelector(h.SELECTORS.PROCESSOR_TYPE))==null?void 0:r.textContent)==null?void 0:a.trim();o!=null&&o.includes(M.PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR)&&(He(),le())},q.TIMEOUTS.DIALOG_DELAY)})},Be=()=>{try{c.info("Initializing tab content components..."),c.info("Initializing issuer config tab");const e=document.getElementById("issuer-config");if(e){const s=()=>c.debug("Issuer config initialized"),i=window.location.href;ne(e,s,i)}else c.warn("Issuer config tab element not found");c.info("Initializing token verification tab");const t=document.getElementById("token-verification");t?te(t,{},"jwt",()=>c.debug("Token verifier initialized")):c.warn("Token verification tab element not found"),c.info("Initializing metrics tab"),re(),c.info("Initializing help tab"),ae(),document.addEventListener("tabChanged",s=>{const i=s.detail;switch(c.debug("Tab changed to:",i.tabId),i.tabId){case"#issuer-config":{const n=document.getElementById("issuer-config");if(n){const o=()=>c.debug("Issuer config re-initialized"),r=window.location.href;ne(n,o,r)}break}case"#token-verification":{const n=document.getElementById("token-verification");n&&te(n,{},"jwt",()=>c.debug("Token verifier re-initialized"));break}case"#metrics":re();break;case"#help":ae();break;default:c.warn("Unknown tab:",i.tabId)}}),c.info("Tab content initialization setup complete")}catch(e){c.error("Failed to initialize tab content:",e)}},_s=()=>new Promise(e=>{try{if(c.debug("JWT UI initialization starting..."),window.jwtInitializationInProgress||window.jwtUISetupComplete){c.debug("Initialization already in progress or complete, skipping"),e(!0);return}window.jwtInitializationInProgress=!0,c.info("PRIORITY: Hiding loading indicator immediately"),k(),c.debug("Registering JWT UI components...");const t=Ss();t?(c.debug("Component registration successful, setting up UI..."),Y(),$e(),qe(),Cs(),Ue(),Be(),c.info("JWT UI initialization completed successfully")):(console.warn("Component registration failed, using fallback..."),Y(),$e(),qe(),Ue(),Be()),setTimeout(()=>{c.debug("100ms safety check: ensuring loading indicator is hidden"),k()},100),setTimeout(()=>{c.debug("500ms safety check: ensuring loading indicator is hidden"),k()},500),setTimeout(()=>{c.debug("Final 1s fallback: ensuring UI is visible and loading hidden"),Y(),k(),le()},q.TIMEOUTS.DIALOG_DELAY),window.jwtInitializationInProgress=!1,e(t)}catch(t){console.error("JWT UI initialization failed:",t),k(),Y(),window.jwtInitializationInProgress=!1,e(!1)}}),k=()=>{try{c.debug("hideLoadingIndicatorRobust: Starting comprehensive loading indicator removal"),Rs(),As(),Os(),window.jwtLoadingIndicatorHidden=!0,window.jwtHideLoadingIndicator=k,c.debug("hideLoadingIndicatorRobust: Comprehensive loading indicator removal completed")}catch(e){console.warn("Error in hideLoadingIndicatorRobust:",e),xs()}},Rs=()=>{const e=document.getElementById(h.IDS.LOADING_INDICATOR);if(e){const t=e.textContent;e.style.setProperty("display","none","important"),e.style.setProperty("visibility","hidden","important"),e.style.setProperty("opacity","0","important"),e.setAttribute("aria-hidden","true"),e.classList.add("hidden"),e.textContent="",e.innerHTML="",c.debug(`Loading indicator hidden via standard ID (was: "${t}")`)}},As=()=>{["#loading-indicator",".loading-indicator",'[id*="loading"]','[class*="loading"]'].forEach(t=>{try{document.querySelectorAll(t).forEach(i=>{i.style.setProperty("display","none","important"),i.style.setProperty("visibility","hidden","important"),i.style.setProperty("opacity","0","important"),i.setAttribute("aria-hidden","true"),i.classList.add("hidden")})}catch(s){console.debug("Selector ignored:",t,s)}})},Os=()=>{var n;const e=document.getElementsByTagName("*"),t=["Loading JWT Validator UI","Loading JWT","Loading"];let s=0;c.debug("hideLoadingByTextContent: Starting scan of",e.length,"elements");for(const o of e){const r=((n=o.textContent)==null?void 0:n.trim())||"";t.some(l=>r.includes(l))&&(c.debug("Found element with loading text:",r,"on element:",o.tagName,o.id,o.className),Ns(r)?(Fe(o,r),s++):c.debug("Element not hidden because shouldHideElement returned false"))}["loading-indicator","simulated-loading","jwt-loading","validator-loading"].forEach(o=>{var a,l;const r=document.getElementById(o);r&&(c.debug(`Found element with ID ${o}:`,(a=r.textContent)==null?void 0:a.trim()),(l=r.textContent)!=null&&l.trim().includes("Loading")&&(Fe(r,r.textContent.trim()),s++))}),c.debug(`hideLoadingByTextContent: Hidden ${s} loading indicators`)},Ns=e=>{c.debug("shouldHideElement checking:",e);const t=e.length<100&&(e==="Loading JWT Validator UI..."||e.startsWith("Loading JWT")||e.startsWith("Loading"));return c.debug("shouldHideElement result:",t),t},Fe=(e,t)=>{e.style.setProperty("display","none","important"),e.style.setProperty("visibility","hidden","important"),e.style.setProperty("opacity","0","important"),e.setAttribute("aria-hidden","true"),e.classList.add("hidden"),e.childNodes.length===1&&e.childNodes[0].nodeType===Node.TEXT_NODE&&(e.textContent=""),c.debug(`Hidden element with loading text: "${t}"`)},xs=()=>{try{const e=document.getElementById("loading-indicator");e&&(e.style.display="none",c.debug("Emergency fallback: basic loading indicator hidden"))}catch(e){console.error("Even emergency fallback failed:",e)}},ze=()=>{try{De(),ws(),window.nifiJwtTooltipObserver&&(window.nifiJwtTooltipObserver.disconnect(),window.nifiJwtTooltipObserver=null),window.jwtLoadingObserver&&(window.jwtLoadingObserver.disconnect(),window.jwtLoadingObserver=null)}catch(e){console.debug(e)}},Je=()=>[{id:"issuer-config-editor",status:"registered"},{id:"token-verifier",status:"registered"},{id:"help-tooltips",status:"registered"}],qe=He,We=()=>_s(),Ke=()=>{k()};typeof module<"u"&&module.exports&&(module.exports={init:We,hideLoadingIndicatorImmediate:Ke,getComponentStatus:Je,cleanup:ze}),w.cleanup=ze,w.getComponentStatus=Je,w.hideLoadingIndicatorImmediate=Ke,w.init=We,Object.defineProperty(w,Symbol.toStringTag,{value:"Module"})});
