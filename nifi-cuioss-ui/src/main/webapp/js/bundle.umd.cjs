(function(p,A){typeof exports=="object"&&typeof module<"u"?A(exports,require("nf.Common"),require("tippy.js")):typeof define=="function"&&define.amd?define(["exports","nf.Common","tippy.js"],A):(p=typeof globalThis<"u"?globalThis:p||self,A(p.nifiCuiossUI={},p.nfCommon,p.tippy))})(this,function(p,A,Xe){"use strict";function Ze(e){const t=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(e){for(const s in e)if(s!=="default"){const i=Object.getOwnPropertyDescriptor(e,s);Object.defineProperty(t,s,i.get?i:{enumerable:!0,get:()=>e[s]})}}return t.default=e,Object.freeze(t)}const g=Ze(A),S={DEBUG:0,INFO:1,WARN:2,ERROR:3,FATAL:4},Qe=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"||window.location.hostname.startsWith("192.168.")||window.location.hostname.endsWith(".local")||window.location.search.includes("debug=true")||localStorage.getItem("nifi-debug")==="true"?S.DEBUG:S.WARN;class F{constructor(t="NiFi-UI",s=Qe){this.component=t,this.logLevel=s,this.startTime=Date.now()}_getTimestamp(){const t=new Date,s=t.getTime()-this.startTime;return`[${t.toISOString()}] (+${s}ms)`}_formatMessage(t,s,...i){return[`${this._getTimestamp()} [${t}] ${this.component}:`,s,...i]}_shouldLog(t){return t>=this.logLevel}debug(t,...s){this._shouldLog(S.DEBUG)&&console.debug(...this._formatMessage("DEBUG",t,...s))}info(t,...s){this._shouldLog(S.INFO)&&console.info(...this._formatMessage("INFO",t,...s))}warn(t,...s){this._shouldLog(S.WARN)&&console.warn(...this._formatMessage("WARN",t,...s))}error(t,...s){this._shouldLog(S.ERROR)&&console.error(...this._formatMessage("ERROR",t,...s))}fatal(t,...s){this._shouldLog(S.FATAL)&&console.error(...this._formatMessage("FATAL",t,...s))}child(t){return new F(`${this.component}:${t}`,this.logLevel)}setLogLevel(t){this.logLevel=t}time(t){const s=performance.now();return this.debug(`Starting operation: ${t}`),()=>{const i=performance.now()-s;this.debug(`Operation completed: ${t} (${i.toFixed(2)}ms)`)}}}const O=new F("NiFi-UI"),B=e=>new F(e);typeof window<"u"&&(window.nifiDebug={enable:()=>{localStorage.setItem("nifi-debug","true"),O.setLogLevel(S.DEBUG),O.info("Debug logging enabled")},disable:()=>{localStorage.removeItem("nifi-debug"),O.setLogLevel(S.WARN),O.info("Debug logging disabled")},setLevel:e=>{O.setLogLevel(e),O.info(`Log level set to: ${Object.keys(S)[e]}`)}});const et=e=>e.map(t=>typeof t=="string"?t:t.msg||"Error detail missing").join(", "),fe=e=>e?typeof e.message=="string"?e.message:Array.isArray(e.errors)&&e.errors.length>0?et(e.errors):null:null,tt=e=>{if(!e)return null;try{const t=JSON.parse(e),s=fe(t);return s!==null?s:e}catch(t){return console.debug("Failed to parse responseText as JSON:",t),e}},G=(e,t)=>{if(e==null)return t["processor.jwt.unknownError"]||"Unknown error";const s=String(e),i=s.trim(),n=s.toLowerCase();return i===""||n==="null"||n==="undefined"?t["processor.jwt.unknownError"]||"Unknown error":e},st=(e,t)=>{if(!e)return t["processor.jwt.unknownError"]||"Unknown error";const s=fe(e.responseJSON);if(s)return G(s,t);const i=tt(e.responseText);if(i)return G(i,t);const n=e.statusText||e.message;return G(n,t)},k=(e,t,s,i="processor.jwt.validationError",n={})=>{const{type:o="error",closable:r=!1,autoHide:a=!1}=n,c=st(t,s),d=s[i]||"Error",E=`
        <div class="error-message ${it(o)} ${r?"closable":""}">
            <div class="error-content">
                <strong>${d}:</strong> ${c}
            </div>
            ${r?'<button class="close-error" aria-label="Close error">&times;</button>':""}
        </div>
    `;if(e.innerHTML=E,r){const T=e.querySelector(".close-error");T&&T.addEventListener("click",()=>{const h=e.querySelector(".error-message");h&&(h.style.transition="opacity 0.3s",h.style.opacity="0",setTimeout(()=>h.remove(),300))})}a&&setTimeout(()=>{const T=e.querySelector(".error-message");T&&(T.style.transition="opacity 0.3s",T.style.opacity="0",setTimeout(()=>T.remove(),300))},5e3)},Y=(e,t,s={})=>{const{autoHide:i=!0}=s,o=`
        <div class="success-message ${i?"auto-dismiss":""}">
            <div class="success-content">${t}</div>
        </div>
    `;e.innerHTML=o,i&&setTimeout(()=>{const r=e.querySelector(".success-message");r&&r.remove()},5e3)},it=e=>{switch(e){case"validation":return"validation-error";case"network":return"network-error";case"server":return"server-error";default:return""}},me=e=>{const{title:t,message:s,confirmText:i="Delete",cancelText:n="Cancel",type:o="danger",onConfirm:r,onCancel:a}=e;return new Promise(c=>{document.querySelectorAll(".confirmation-dialog").forEach(u=>u.remove());const d=nt(t,s,i,n,o),m=document.createElement("div");m.innerHTML=d;const w=m.firstElementChild;document.body.appendChild(w),ot(w,c,r,a),requestAnimationFrame(()=>{w.classList.add("show");const u=w.querySelector(".cancel-button");u&&u.focus()})})},z=e=>{const t=document.createElement("div");return t.textContent=e,t.innerHTML},nt=(e,t,s,i,n)=>{const o=at(n),r=ct(n);return`
        <div class="confirmation-dialog ${o}">
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <div class="dialog-header">
                    <div class="dialog-icon">${r}</div>
                    <h3 class="dialog-title">${z(e)}</h3>
                </div>
                <div class="dialog-body">
                    <p class="dialog-message">${z(t)}</p>
                </div>
                <div class="dialog-footer">
                    <button class="cancel-button">${z(i)}</button>
                    <button class="confirm-button ${n}-button">
                        ${z(s)}
                    </button>
                </div>
            </div>
        </div>
    `},ot=(e,t,s,i)=>{const n=()=>{he(e),s&&s(),t(!0)},o=()=>{he(e),i&&i(),t(!1)},r=e.querySelector(".confirm-button"),a=e.querySelector(".cancel-button");r&&r.addEventListener("click",n),a&&a.addEventListener("click",o);const c=e.querySelector(".dialog-overlay");c&&c.addEventListener("click",o),e.addEventListener("keydown",d=>{d.key==="Escape"?(d.preventDefault(),o()):d.key==="Enter"&&d.target.classList.contains("confirm-button")&&(d.preventDefault(),n())}),rt(e)},he=e=>{e.classList.remove("show"),setTimeout(()=>{e.remove()},300)},rt=e=>{const t=e.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),s=t[0],i=t[t.length-1];e.addEventListener("keydown",n=>{n.key==="Tab"&&(n.shiftKey?document.activeElement===s&&(n.preventDefault(),i&&i.focus()):document.activeElement===i&&(n.preventDefault(),s&&s.focus()))})},at=e=>{switch(e){case"danger":return"dialog-danger";case"warning":return"dialog-warning";case"info":return"dialog-info";default:return"dialog-danger"}},ct=e=>{switch(e){case"danger":return"🗑️";case"warning":return"⚠️";case"info":return"ℹ️";default:return"🗑️"}},lt=(e,t)=>me({title:"Remove Issuer Configuration",message:`Are you sure you want to remove the issuer "${e}"? This action cannot be undone.`,confirmText:"Remove",cancelText:"Cancel",type:"danger",onConfirm:t}),dt=e=>me({title:"Clear Form Data",message:"Are you sure you want to clear all form data? Any unsaved changes will be lost.",confirmText:"Clear",cancelText:"Cancel",type:"warning",onConfirm:e}),J={BASE_URL:"../nifi-api/processors/jwt",NIFI_BASE_URL:"../nifi-api/processors",ENDPOINTS:{VALIDATE_JWKS_URL:"/validate-jwks-url",VERIFY_TOKEN:"/verify-token",GET_ISSUER_CONFIG:"/issuer-config",SET_ISSUER_CONFIG:"/issuer-config",JWKS_VALIDATE_URL:"../nifi-api/processors/jwks/validate-url",JWT_VERIFY_TOKEN:"../nifi-api/processors/jwt/verify-token"},TIMEOUTS:{DEFAULT:5e3,LONG_OPERATION:1e4,SHORT_OPERATION:2e3,DIALOG_DELAY:500,UI_FALLBACK_TIMEOUT:3e3,TOKEN_CACHE_DURATION:36e5,ERROR_DISPLAY_TIMEOUT:5e3}},f={CLASSES:{SUCCESS_MESSAGE:"success-message",ERROR_MESSAGE:"error-message",WARNING_MESSAGE:"warning-message",LOADING:"loading",HIDDEN:"hidden",DISABLED:"disabled",INVALID:"invalid",VALID:"valid",PROPERTY_LABEL:"property-label",HELP_TOOLTIP:"help-tooltip",PROCESSOR_DIALOG:"processor-dialog",PROCESSOR_TYPE:"processor-type",JWT_VALIDATOR_TITLE:"jwt-validator-title",FA:"fa",FA_QUESTION_CIRCLE:"fa-question-circle"},SELECTORS:{ERROR_CONTAINER:".error-container",SUCCESS_CONTAINER:".success-container",LOADING_INDICATOR:".loading-indicator",FORM_GROUP:".form-group",INPUT_FIELD:".input-field",BUTTON:".button",TOOLTIP:".tooltip",PROPERTY_LABEL:".property-label",HELP_TOOLTIP:".help-tooltip",PROCESSOR_DIALOG:".processor-dialog",PROCESSOR_TYPE:".processor-type",JWT_VALIDATOR_TITLE:".jwt-validator-title"},IDS:{LOADING_INDICATOR:"loading-indicator",JWT_VALIDATOR_TABS:"jwt-validator-tabs"},ISSUER_CONFIG:{CONTAINER:"issuer-config-editor",ISSUERS_CONTAINER:"issuers-container",GLOBAL_ERROR_MESSAGES:"global-error-messages",ADD_ISSUER_BUTTON:"add-issuer-button",REMOVE_ISSUER_BUTTON:"remove-issuer-button",SAVE_ISSUER_BUTTON:"save-issuer-button",ISSUER_FORM:"issuer-form",FORM_HEADER:"form-header",FORM_FIELDS:"form-fields"},TOKEN_VERIFIER:{CONTAINER:"token-verification-container",INPUT_SECTION:"token-input-section",RESULTS_SECTION:"token-results-section",TOKEN_INPUT:"token-input",VERIFY_BUTTON:"verify-token-button",RESULTS_CONTENT:"token-results-content",TOKEN_ERROR:"token-error",TOKEN_LOADING:"token-loading",TOKEN_VALID:"token-valid",TOKEN_INVALID:"token-invalid",TOKEN_DETAILS:"token-details",TOKEN_ERROR_DETAILS:"token-error-details",TOKEN_ERROR_MESSAGE:"token-error-message",TOKEN_ERROR_CATEGORY:"token-error-category",TOKEN_RAW_CLAIMS:"token-raw-claims",TOKEN_CLAIMS_TABLE:"token-claims-table",TOKEN_INSTRUCTIONS:"token-instructions"},JWKS_VALIDATOR:{CONTAINER:"jwks-verification-container",BUTTON_WRAPPER:"jwks-button-wrapper",VERIFY_BUTTON:"verify-jwks-button",VERIFICATION_RESULT:"verification-result"}},N={ISSUER_CONFIG_EDITOR:{DEFAULT_ISSUER_NAME:"sample-issuer",SAMPLE_ISSUER_URL:"https://sample-issuer.example.com",SAMPLE_JWKS_URL:"https://sample-issuer.example.com/.well-known/jwks.json",SAMPLE_AUDIENCE:"sample-audience",SAMPLE_CLIENT_ID:"sample-client"}},M={COMPONENT_TABS:{ISSUER_CONFIG:"jwt.validation.issuer.configuration",TOKEN_VERIFICATION:"jwt.validation.token.verification",METRICS:"jwt.validation.metrics",HELP:"jwt.validation.help"},PROCESSOR_TYPES:{MULTI_ISSUER_JWT_AUTHENTICATOR:"MultiIssuerJWTTokenAuthenticator"}},C={HELP_TEXT_KEYS:{TOKEN_LOCATION:"property.token.location.help",TOKEN_HEADER:"property.token.header.help",CUSTOM_HEADER_NAME:"property.custom.header.name.help",BEARER_TOKEN_PREFIX:"property.bearer.token.prefix.help",REQUIRE_VALID_TOKEN:"property.require.valid.token.help",JWKS_REFRESH_INTERVAL:"property.jwks.refresh.interval.help",MAXIMUM_TOKEN_SIZE:"property.maximum.token.size.help",ALLOWED_ALGORITHMS:"property.allowed.algorithms.help",REQUIRE_HTTPS_JWKS:"property.require.https.jwks.help"},PROPERTY_LABELS:{"Token Location":"property.token.location.help","Token Header":"property.token.header.help","Custom Header Name":"property.custom.header.name.help","Bearer Token Prefix":"property.bearer.token.prefix.help","Require Valid Token":"property.require.valid.token.help","JWKS Refresh Interval":"property.jwks.refresh.interval.help","Maximum Token Size":"property.maximum.token.size.help","Allowed Algorithms":"property.allowed.algorithms.help","Require HTTPS for JWKS URLs":"property.require.https.jwks.help"},I18N_KEYS:{JWT_VALIDATOR_LOADING:"jwt.validator.loading",JWT_VALIDATOR_TITLE:"jwt.validator.title",METRICS_TITLE:"jwt.validator.metrics.title",METRICS_TAB_NAME:"jwt.validator.metrics.tab.name",HELP_TITLE:"jwt.validator.help.title",HELP_TAB_NAME:"jwt.validator.help.tab.name"}},y={PATTERNS:{URL:new RegExp("^https?:\\/\\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$"),HTTPS_URL:new RegExp("^https:\\/\\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$"),SAFE_STRING:/^[a-zA-Z0-9._-]+$/},LIMITS:{ISSUER_NAME_MIN:2,ISSUER_NAME_MAX:100,AUDIENCE_MAX:500,CLIENT_ID_MAX:200,URL_MAX:2048}},I=(e,t={})=>{const s=document.createElement(e);return t.css&&(Array.isArray(t.css)?s.classList.add(...t.css):typeof t.css=="string"&&(s.className=t.css)),t.className&&(s.className=t.className),t.text&&(s.textContent=t.text),t.html&&(t.sanitized===!0?s.innerHTML=t.html:s.textContent=t.html),t.attributes&&Object.entries(t.attributes).forEach(([i,n])=>{if(i==="disabled"||i==="checked"||i==="readonly"||i==="required")if(n===!0||n==="true"||n==="")s.setAttribute(i,"");else{if(n===!1||n==="false"||n===null||n===void 0)return;s.setAttribute(i,n)}else s.setAttribute(i,n)}),t.events&&Object.entries(t.events).forEach(([i,n])=>{s.addEventListener(i,n)}),t.children&&t.children.forEach(i=>{i instanceof Element?s.appendChild(i):typeof i=="string"&&s.appendChild(document.createTextNode(i))}),s};class j{constructor(t={}){this.defaultOptions={i18n:t.i18n||{},cssClasses:t.cssClasses||f,validationEnabled:t.validationEnabled!==!1,containerClass:"form-field",labelSuffix:":",showDescriptions:t.showDescriptions!==!1}}createField(t){const{name:s,label:i,description:n,value:o="",type:r="text",required:a=!1,placeholder:c=n,validation:d=null,events:m={},cssClass:w="",helpText:u=null,disabled:E=!1,attributes:T={}}=t,h=this._createFieldContainer(s,w),de=this._createLabel(s,i,a);h.appendChild(de);const ue=this._createInput(s,r,o,c,E,T);if(h.appendChild(ue),this.defaultOptions.showDescriptions&&n){const pe=this._createDescription(n);h.appendChild(pe)}if(u){const pe=this._createHelpText(u);h.appendChild(pe)}this.defaultOptions.validationEnabled&&d&&this._addValidation(ue,d),this._attachEventHandlers(ue,m);const Cs=this._createErrorContainer(s);return h.appendChild(Cs),h}createButton(t){const{text:s,type:i="button",cssClass:n="",variant:o="primary",onClick:r=null,disabled:a=!1,icon:c=null,attributes:d={}}=t,m=["btn",`btn-${o}`,n].filter(Boolean),w={type:i,disabled:a,...d},u=I("button",{css:m,attributes:w});if(c){const E=I("i",{css:["fa",c]});u.appendChild(E),u.appendChild(document.createTextNode(" "))}return u.appendChild(document.createTextNode(s)),r&&u.addEventListener("click",r),u}createSection(t){const{title:s,content:i=[],cssClass:n="",collapsible:o=!1,expanded:r=!0}=t,a=I("div",{css:["form-section",n].filter(Boolean)});if(s){const d=I("div",{css:["form-section-header"],text:s});if(o){const m=I("i",{css:["fa",r?"fa-chevron-down":"fa-chevron-right"]});d.appendChild(m),d.addEventListener("click",()=>this._toggleSection(a)),d.style.cursor="pointer"}a.appendChild(d)}const c=I("div",{css:["form-section-content",!r&&o?"hidden":""].filter(Boolean)});return i.forEach(d=>{d instanceof Element&&c.appendChild(d)}),a.appendChild(c),a}validateContainer(t){const s=t.querySelectorAll("input, textarea, select"),i=[];let n=!0;return s.forEach(o=>{if(o._validate){const r=o._validate();r.isValid||(n=!1,i.push({field:o.name,error:r.error}))}}),{isValid:n,errors:i}}resetContainer(t){t.querySelectorAll("input, textarea, select").forEach(i=>{var o;i.value="",i.classList.remove("valid","invalid");const n=(o=i.parentElement)==null?void 0:o.querySelector(".field-error");n&&(n.classList.add("hidden"),n.textContent="")})}_createFieldContainer(t,s=""){return I("div",{css:[this.defaultOptions.containerClass,`field-container-${t}`,s].filter(Boolean)})}_createLabel(t,s,i){const n=s+this.defaultOptions.labelSuffix+(i?" *":"");return I("label",{text:n,attributes:{for:`field-${t}`},css:["field-label",i?"required":""].filter(Boolean)})}_createInput(t,s,i,n,o,r){const a={id:`field-${t}`,name:t,placeholder:n,...r};o===!0&&(a.disabled=o);const c=I(s==="textarea"?"textarea":"input",{css:[`field-${t}`,"form-input"],attributes:a});return s!=="textarea"&&c.setAttribute("type",s),i&&(s==="textarea"?c.textContent=i:c.value=i),c}_createDescription(t){return I("div",{css:["field-description"],text:t})}_createHelpText(t){return I("div",{css:["field-help","help-tooltip"],text:t,attributes:{title:t}})}_createErrorContainer(t){return I("div",{css:[`field-error-${t}`,"field-error","hidden"],attributes:{role:"alert","aria-live":"polite"}})}_addValidation(t,s){const i=()=>{const n=t.value,o=typeof s=="function"?s(n):s.validate(n),r=t.parentElement.querySelector(".field-error");return o.isValid?(t.classList.remove("invalid"),t.classList.add("valid"),r&&(r.classList.add("hidden"),r.textContent="")):(t.classList.remove("valid"),t.classList.add("invalid"),r&&(r.classList.remove("hidden"),r.textContent=o.error||"Invalid input")),o};t.addEventListener("blur",i),t.addEventListener("input",()=>{if(t.classList.contains("invalid")){t.classList.remove("invalid");const n=t.parentElement.querySelector(".field-error");n&&n.classList.add("hidden")}}),t._validate=i}_attachEventHandlers(t,s){Object.entries(s).forEach(([i,n])=>{typeof n=="function"&&t.addEventListener(i,n)})}_toggleSection(t){const s=t.querySelector(".form-section-content"),i=t.querySelector(".fa");s&&i&&(s.classList.toggle("hidden"),i.classList.toggle("fa-chevron-down"),i.classList.toggle("fa-chevron-right"))}}const ut=e=>new j().createField(e),pt=e=>new j().createButton(e),ft=e=>new j().createSection(e);class mt{static createField(t){return ut(t)}static createButton(t){return pt(t)}static createSection(t){return ft(t)}static createFactory(t){return new j(t)}}const X=function(e,t,s){return e?{status:e.status,statusText:e.statusText||s||t||"Unknown error",responseText:e.responseText}:{status:0,statusText:"Unknown error",responseText:""}},ge=J.BASE_URL,ht=()=>{if(window.jwtAuthConfig&&window.jwtAuthConfig.processorId&&window.jwtAuthConfig.apiKey)return window.jwtAuthConfig;const e=new URLSearchParams(window.location.search),t=e.get("id")||e.get("processorId"),s=e.get("apiKey");return t?(window.jwtAuthConfig={processorId:t,apiKey:s||""},window.jwtAuthConfig):{processorId:"",apiKey:""}},W=(e,t,s=null,i=!0)=>{const n={method:e,url:t};if(i&&t.includes("/jwt/")){const r=ht();n.headers={"X-API-Key":r.apiKey,"X-Processor-Id":r.processorId},s&&r.processorId&&(s.processorId=r.processorId)}s&&(n.data=JSON.stringify(s),n.contentType="application/json");const o={method:n.method||"GET",headers:n.headers||{},credentials:"same-origin"};return n.data&&(o.body=n.data,n.contentType&&(o.headers["Content-Type"]=n.contentType)),fetch(n.url,o).then(r=>r.ok?r.json():r.text().then(a=>{throw X({status:r.status,statusText:r.statusText,responseText:a})}))},gt=e=>W("POST",`${ge}/verify-token`,{token:e}).catch(t=>{throw X(t)}),vt=()=>W("GET",`${ge}/metrics`).catch(e=>{throw X(e)}),Z=e=>W("GET",`../nifi-api/processors/${e}`),ve=(e,t)=>Z(e).then(s=>{const i={revision:s.revision,component:{id:e,properties:t}};return W("PUT",`../nifi-api/processors/${e}`,i)}),Q=async(e,t,s,i)=>{try{await Et(e,i)}catch(n){throw typeof i=="function"&&i({validate:()=>!1,error:n.message}),n}},Et=async(e,t)=>{if(!e)throw new Error("Token verifier element is required");const s=g.getI18n()||{},i=new j({i18n:s}),n=document.createElement("div");n.className=f.TOKEN_VERIFIER.CONTAINER;const o=document.createElement("div");o.className=f.TOKEN_VERIFIER.INPUT_SECTION;const r=i.createField({name:"token-input",label:s["processor.jwt.tokenInput"]||"Enter Token",description:s["processor.jwt.tokenInputDescription"]||"Paste your JWT token for verification",placeholder:s["processor.jwt.tokenInputPlaceholder"]||"Paste token here...",type:"textarea",required:!0,cssClass:"token-verifier-field",attributes:{rows:5},disabled:!1}),a=i.createButton({text:s["processor.jwt.verifyToken"]||"Verify Token",variant:"primary",cssClass:f.TOKEN_VERIFIER.VERIFY_BUTTON,icon:"fa-check"}),c=i.createButton({text:"Clear",variant:"secondary",cssClass:"clear-token-button",icon:"fa-trash"}),d=document.createElement("div");d.className="button-container",d.appendChild(a),d.appendChild(c),o.appendChild(r),o.appendChild(d);const m=document.createElement("div");m.className=f.TOKEN_VERIFIER.RESULTS_SECTION;const w=document.createElement("h3");w.textContent=s["processor.jwt.verificationResults"]||"Verification Results";const u=document.createElement("div");u.className=f.TOKEN_VERIFIER.RESULTS_CONTENT,m.appendChild(w),m.appendChild(u),n.appendChild(o),n.appendChild(m),e.appendChild(n),a.addEventListener("click",async()=>{const E=r.querySelector("#field-token-input"),T=E?E.value.trim():"";if(!T){k(u,null,s,"processor.jwt.noTokenProvided");return}u.innerHTML=`<div class="verifying">${s["processor.jwt.verifying"]||"Verifying token..."}</div>`;try{const h=await gt(T);Tt(h,u,s)}catch(h){const de=h.jqXHR||{status:h.status||500,statusText:h.statusText||"Error",responseJSON:h.responseJSON||{error:h.message||"Unknown error"}};k(u,de,s)}}),c.addEventListener("click",()=>{dt(()=>{const E=r.querySelector("#field-token-input");E&&(E.value=""),u.innerHTML=""})}),typeof t=="function"&&t({validate:()=>!0,getValue:()=>{const E=r.querySelector("#field-token-input");return E?E.value:""},setValue:E=>{const T=r.querySelector("#field-token-input");T&&(T.value=E)}})},Tt=(e,t,s)=>{const i=e.valid===!0,n=i?"valid":"invalid",o=i?s["processor.jwt.tokenValid"]||"Token is valid":s["processor.jwt.tokenInvalid"]||"Token is invalid";let r=`
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
            `;const a=e.decoded.payload;if(r+='<div class="token-claims">',a.exp){const c=new Date(a.exp*1e3),d=c<new Date;r+=`
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
                `),r+="</div>"}r+="</div>"}e.error&&(r+=`
            <div class="verification-error">
                <strong>${s["processor.jwt.error"]||"Error"}:</strong>
                ${e.error}
            </div>
        `),t.innerHTML=r},Ee=Object.freeze(Object.defineProperty({__proto__:null,cleanup:()=>{},init:Q},Symbol.toStringTag,{value:"Module"})),U=(e,t=!0)=>{const s=e==null,n=(s?"":String(e)).trim(),o=n===""||n.toLowerCase()==="null"||n.toLowerCase()==="undefined";return t&&(s||o)?{isValid:!1,error:"This field is required.",sanitizedValue:""}:{isValid:!0,sanitizedValue:n}},bt=e=>{const t=U(e);if(!t.isValid)return{isValid:!1,error:"URL is required for processor ID extraction.",sanitizedValue:""};const s=t.sanitizedValue,n=/\/processors\/([a-f0-9-]+)/i.exec(s);return n?{isValid:!0,sanitizedValue:n[1].toLowerCase()}:{isValid:!1,error:"URL does not contain a valid processor ID.",sanitizedValue:""}},Te=(e,t={})=>{const{httpsOnly:s=!1,maxLength:i=y.LIMITS.URL_MAX}=t,n=U(e);if(!n.isValid)return{isValid:!1,error:"URL is required.",sanitizedValue:""};const o=n.sanitizedValue;return o.length>i?{isValid:!1,error:`URL is too long (maximum ${i} characters).`,sanitizedValue:o}:(s?y.PATTERNS.HTTPS_URL:y.PATTERNS.URL).test(o)?{isValid:!0,sanitizedValue:o}:{isValid:!1,error:`Invalid URL format. Must be a valid ${s?"HTTPS":"HTTP/HTTPS"} URL.`,sanitizedValue:o}},yt=e=>{const t=U(e);if(!t.isValid)return{isValid:!1,error:"Issuer name is required.",sanitizedValue:""};const s=t.sanitizedValue;return s.length<y.LIMITS.ISSUER_NAME_MIN?{isValid:!1,error:`Issuer name must be at least ${y.LIMITS.ISSUER_NAME_MIN} characters long.`,sanitizedValue:s}:s.length>y.LIMITS.ISSUER_NAME_MAX?{isValid:!1,error:`Issuer name is too long (maximum ${y.LIMITS.ISSUER_NAME_MAX} characters).`,sanitizedValue:s}:y.PATTERNS.SAFE_STRING.test(s)?{isValid:!0,sanitizedValue:s}:{isValid:!1,error:"Issuer name can only contain letters, numbers, hyphens, underscores, and dots.",sanitizedValue:s}},It=(e,t=!1)=>{const s=U(e,t);if(!s.isValid)return s;if(!t&&s.sanitizedValue==="")return{isValid:!0,sanitizedValue:""};const i=s.sanitizedValue;return i.length>y.LIMITS.AUDIENCE_MAX?{isValid:!1,error:`Audience is too long (maximum ${y.LIMITS.AUDIENCE_MAX} characters).`,sanitizedValue:i}:{isValid:!0,sanitizedValue:i}},wt=(e,t=!1)=>{const s=U(e,t);if(!s.isValid)return s;if(!t&&s.sanitizedValue==="")return{isValid:!0,sanitizedValue:""};const i=s.sanitizedValue;return i.length>y.LIMITS.CLIENT_ID_MAX?{isValid:!1,error:`Client ID is too long (maximum ${y.LIMITS.CLIENT_ID_MAX} characters).`,sanitizedValue:i}:{isValid:!0,sanitizedValue:i}},St=e=>{const t=[],s={},i=yt(e.issuerName);i.isValid||t.push(`Issuer Name: ${i.error}`),s.issuerName=i.sanitizedValue;const n=Te(e.issuer,{httpsOnly:!1});n.isValid||t.push(`Issuer URI: ${n.error}`),s.issuer=n.sanitizedValue;const o=Te(e["jwks-url"],{httpsOnly:!1});o.isValid||t.push(`JWKS URL: ${o.error}`),s["jwks-url"]=o.sanitizedValue;const r=It(e.audience,!1);r.isValid||t.push(`Audience: ${r.error}`),s.audience=r.sanitizedValue;const a=wt(e["client-id"],!1);return a.isValid||t.push(`Client ID: ${a.error}`),s["client-id"]=a.sanitizedValue,t.length>0?{isValid:!1,error:t.join(" "),sanitizedValue:s}:{isValid:!0,sanitizedValue:s}};class Lt{constructor(t){this.componentId=t,this.initialized=!1,this.timeouts=new Set}async initialize(t){try{t&&await t(),this.initialized=!0}catch(s){console.debug(s)}}isComponentInitialized(){return this.initialized}setTimeout(t,s){const i=setTimeout(()=>{this.timeouts.delete(i),t()},s);return this.timeouts.add(i),i}destroy(){this.timeouts.forEach(clearTimeout),this.timeouts.clear(),this.initialized=!1}}const v=A.getI18n()||{};let V=null;const ee=()=>({name:N.ISSUER_CONFIG_EDITOR.DEFAULT_ISSUER_NAME,properties:{issuer:N.ISSUER_CONFIG_EDITOR.SAMPLE_ISSUER_URL,"jwks-url":N.ISSUER_CONFIG_EDITOR.SAMPLE_JWKS_URL,audience:N.ISSUER_CONFIG_EDITOR.SAMPLE_AUDIENCE,"client-id":N.ISSUER_CONFIG_EDITOR.SAMPLE_CLIENT_ID}}),_t=e=>`<span class="success-message">${e}</span>`,kt=(e,t=!1)=>{const s=v["processor.jwt.ok"]||"OK",i=v["processor.jwt.validJwks"]||"Valid JWKS",n=v["processor.jwt.keysFound"]||"keys found",o=t?" <em>(Simulated response)</em>":"";return`${_t(s)} ${i} (${e} ${n})${o}`},be=e=>{const t={};return Object.entries(e).filter(([s])=>s.startsWith("issuer.")).forEach(([s,i])=>{const n=s.slice(7).split(".");if(n.length===2){const[o,r]=n;t[o]||(t[o]={}),t[o][r]=i}}),t},Ct=e=>{var t,s;return((s=(t=e==null?void 0:e[0])==null?void 0:t.value)==null?void 0:s.trim())||""},ye=e=>{const t=s=>{const i=e.querySelector(s);return i?i.value.trim():""};return{issuerName:t(".issuer-name"),issuer:t(".field-issuer"),"jwks-url":t(".field-jwks-url"),audience:t(".field-audience"),"client-id":t(".field-client-id")}},Rt=()=>document.querySelector(".global-error-messages"),At=e=>{const t=document.createElement("div");t.className="issuer-config-editor",e.appendChild(t);const s=v["Jwt.Validation.Issuer.Configuration"]||"Issuer Configurations",i=document.createElement("h3");i.textContent=s,t.appendChild(i);const n=v["issuer.config.description"]||"Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.",o=document.createElement("p");o.textContent=n,t.appendChild(o);const r=document.createElement("div");r.className="global-error-messages issuer-form-error-messages",r.style.display="none",t.appendChild(r);const a=document.createElement("div");return a.className="issuers-container",t.appendChild(a),{container:t,issuersContainer:a,globalErrorContainer:r}},Ot=(e,t,s=null)=>{const i=document.createElement("button");i.className="add-issuer-button",i.textContent="Add Issuer",e.appendChild(i);const n=()=>{const o=ee();P(t,o.name+"-"+Date.now(),o.properties,s)};i.addEventListener("click",n)},Nt=async(e,t)=>{const s=x(e);await jt(t,s)},Mt=async(e,t)=>{const s=x(t),{container:i,issuersContainer:n}=At(e);Ot(i,n,s),await Nt(t,n)},x=e=>{const t=bt(e);return t.isValid?t.sanitizedValue:""},jt=async(e,t)=>{if(!t){const s=ee();P(e,s.name,s.properties,t);return}try{const i=(await Z(t)).properties||{},n=be(i);Object.keys(n).forEach(o=>{P(e,o,n[o],t)})}catch(s){console.debug(s);const i=ee();P(e,i.name,i.properties,t)}},Ut=(e,t)=>{const s=document.createElement("div");s.className="form-header";const i=document.createElement("label");i.textContent="Issuer Name:",s.appendChild(i);const n=document.createElement("input");n.type="text",n.className="issuer-name",n.placeholder="e.g., keycloak",n.title="Unique identifier for this issuer configuration. Use alphanumeric characters and hyphens only.",i.appendChild(n),e&&(n.value=e);const o=document.createElement("button");o.className="remove-issuer-button",o.title="Delete this issuer configuration",o.textContent="Remove",s.appendChild(o);const r=async()=>{const a=n.value||"Unnamed Issuer";await lt(a,()=>{t(a)})};return o.addEventListener("click",r),s},Vt=()=>{const e=document.createElement("div");e.className="jwks-button-wrapper";const t=document.createElement("button");t.type="button",t.className="verify-jwks-button",t.title="Test connectivity to the JWKS endpoint and verify it returns valid keys",t.textContent="Test Connection";const s=`<em>${v["jwksValidator.initialInstructions"]||"Click the button to validate JWKS"}</em>`,i=document.createElement("div");return i.className="verification-result",i.innerHTML=s,e.appendChild(t),e.appendChild(i),{testButtonWrapper:e,testButton:t,resultContainer:i}},xt=(e,t)=>{const s=e.querySelector(".field-jwks-url"),i=s?s.closest(".form-field"):null;i?i.insertAdjacentElement("afterend",t):e.appendChild(t)},Ie=(e,t)=>{t.valid?e.innerHTML=kt(t.keyCount):k(e,{responseJSON:t},v,"processor.jwt.invalidJwks")},te=(e,t,s)=>{k(e,t,v,"processor.jwt.validationError")},we=(e,t)=>{try{return fetch(J.ENDPOINTS.JWKS_VALIDATE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jwksValue:e}),credentials:"same-origin"}).then(s=>s.ok?s.json():s.text().then(i=>{const n=new Error(`HTTP ${s.status}: ${s.statusText}`);n.status=s.status,n.statusText=s.statusText,n.responseText=i;try{n.responseJSON=JSON.parse(i)}catch{}throw n})).then(s=>Ie(t,s)).catch(s=>te(t,s,!0))}catch(s){return te(t,s),Promise.reject(s)}},Pt=(e,t)=>{const{testButtonWrapper:s,testButton:i,resultContainer:n}=Vt();xt(e,s);const o=()=>{n.innerHTML=v["processor.jwt.testing"]||"Testing...";const r=t();we(r,n)};i.addEventListener("click",o)},Dt=(e,t=null)=>{const s=t?"Save this issuer configuration to the NiFi processor":"Validate and save this issuer configuration (standalone mode)",i=document.createElement("button");i.className="save-issuer-button",i.title=s,i.textContent="Save Issuer";const n=document.createElement("div");n.className="issuer-form-error-messages";const o=()=>{n.innerHTML="",Ce(e,n,t)};return i.addEventListener("click",o),e.appendChild(n),i},Ht=(e,t)=>{D(e,"issuer","Issuer URI","The URI of the token issuer (must match the iss claim)",t?t.issuer:"",'This value must exactly match the "iss" claim in JWT tokens. Example: https://auth.example.com/auth/realms/myrealm'),D(e,"jwks-url","JWKS URL","The URL of the JWKS endpoint",t?t["jwks-url"]:"","URL providing public keys for JWT signature verification. Usually ends with /.well-known/jwks.json"),Pt(e,()=>{const s=e.querySelector(".field-jwks-url");return s?s.value:""}),D(e,"audience","Audience","The expected audience claim value",t?t.audience:"",'Optional: Expected "aud" claim value in JWT tokens. Leave blank to accept any audience.'),D(e,"client-id","Client ID","The client ID for token validation",t?t["client-id"]:"",'Optional: Expected "azp" or "client_id" claim value. Used for additional token validation.')},$t=(e,t,s=null)=>{const i=document.createElement("div");i.className="issuer-form";const n=Ut(e,a=>{Oe(i,a)});i.appendChild(n);const o=document.createElement("div");o.className="form-fields",i.appendChild(o),Ht(o,t);const r=Dt(i,s);return i.appendChild(r),i},P=(e,t,s,i=null)=>{const n=$t(t,s,i);e.appendChild(n)},D=(e,t,s,i,n,o)=>{const r={name:t,label:s,description:i,value:n||"",placeholder:i,type:"text",required:!1,cssClass:"issuer-config-field",helpText:o||null,validation:t==="jwks-url"||t==="issuer"?c=>c!=null&&c.trim()?{isValid:!0}:{isValid:!1,error:"This field is required"}:null},a=mt.createField(r);e.appendChild(a)},Se=e=>{if(!e.issuerName)return{isValid:!1,error:new Error(v["issuerConfigEditor.error.issuerNameRequired"]||"Issuer name is required.")};const s={issuer:e.issuer,"jwks-url":e["jwks-url"],audience:e.audience,"client-id":e["client-id"]};if(!s.issuer||!s["jwks-url"])return{isValid:!1,error:new Error(v["issuerConfigEditor.error.requiredFields"]||"Issuer URI and JWKS URL are required.")};const i=St(e);return i.isValid||console.debug("Enhanced validation warnings:",i.error),{isValid:!0}},Le=(e,t)=>{const s={issuer:t.issuer,"jwks-url":t["jwks-url"],audience:t.audience,"client-id":t["client-id"]},i={};return Object.keys(s).forEach(n=>{s[n]&&(i[`issuer.${e}.${n}`]=s[n])}),i},_e=async(e,t,s,i)=>{try{await ve(e,s),Y(i,v["issuerConfigEditor.success.saved"]||"Issuer configuration saved successfully.")}catch(n){k(i,n,v,"issuerConfigEditor.error.saveFailedTitle")}},ke=e=>{Y(e,v["issuerConfigEditor.success.savedStandalone"]||"Issuer configuration saved successfully (standalone mode).")},Ce=async(e,t,s=null)=>{t.innerHTML="";const i=ye(e),n=Se(i);if(!n.isValid){k(t,n.error,v,"issuerConfigEditor.error.title");return}const o=i.issuerName,r=Le(o,i);s?await _e(s,o,r,t):ke(t)},Ft=(e,t)=>{const s={};return Object.keys(e).forEach(i=>{i.startsWith(`issuer.${t}.`)&&(s[i]=null)}),s},Re=(e,t,s=!1)=>{if(!e)return;const i=s?`Issuer "${t}" removed (standalone mode).`:`Issuer "${t}" removed successfully.`;Y(e,i),e.style.display="block"},Ae=(e,t)=>{if(e){const s=typeof t=="string"?new Error(t):t;k(e,s,v,"issuerConfigEditor.error.removeFailedTitle"),e.style.display="block"}else{const s=typeof t=="string"?t:t.message;console.error("Failed to remove issuer:",s)}},Bt=async(e,t,s)=>{try{const n=(await Z(e)).properties||{},o=Ft(n,t);if(Object.keys(o).length===0&&t!=="sample-issuer"){console.info(`No properties found to remove for issuer: ${t}`);return}await ve(e,o),Re(s,t,!1)}catch(i){Ae(s,i)}},Oe=async(e,t)=>{e.remove();const s=x(window.location.href),i=t,n=Rt();i&&s?await Bt(s,i,n):i&&!s?Re(n,i,!0):Ae(n,i?"Cannot remove issuer: no processor context found":"Issuer name missing for removal")},zt=(e,t)=>e?!0:(typeof t=="function"&&t(),!1),Jt=()=>window.location.href,Wt=e=>{const s=`issuer-config-editor-${x(e)||"standalone"}`;setTimeout(()=>{V=new Lt(s),V.initialize(async()=>{})},0)},Ne=e=>{typeof e=="function"&&e()},se=async(e,t)=>{if(zt(e,t))try{const s=Jt();Wt(s),await Mt(e,s),Ne(t)}catch(s){console.debug(s),Ne(t)}},Me=Object.freeze(Object.defineProperty({__proto__:null,__test_exports:{saveIssuer:Ce,removeIssuer:Oe,addIssuerForm:P,addFormField:D,getProcessorIdFromUrl:x,_parseIssuerProperties:be,_extractFieldValue:Ct,_extractFormFields:ye,_validateIssuerFormData:Se,_createPropertyUpdates:Le,_saveIssuerToServer:_e,_saveIssuerStandalone:ke,_handleJwksValidationResponse:Ie,_handleJwksValidationError:te,_performJwksValidation:we},cleanup:()=>{V&&(V.destroy(),V=null)},init:se},Symbol.toStringTag,{value:"Module"})),qt=function(e){if(!e)return"";try{const t=new Date(e);return isNaN(t.getTime())?(e!=="not-a-date"&&console.warn(`Invalid date format: ${e}`),e):t.toLocaleString()}catch(t){return console.warn(`Error formatting date: ${e}`,t),window._formattersErrors===void 0&&(window._formattersErrors=[]),window._formattersErrors.push({function:"formatDate",input:e,error:t.message,timestamp:new Date().toISOString()}),e}},je=function(e){return e==null?"":new Intl.NumberFormat("en-US").format(e)},b=B("MetricsTab"),Ue=e=>(e*100).toFixed(1)+"%",Ve=e=>qt(e),ie=()=>{b.info("Initializing metrics tab"),document.getElementById("jwt-metrics-content")?b.debug("Metrics tab content already exists, skipping creation"):(b.info("Creating metrics tab content..."),Kt(),Gt())},Kt=()=>{const e=`
        <div id="jwt-metrics-content" class="jwt-tab-content" data-testid="metrics-tab-content">
            <div class="metrics-header">
                <h3>${g.getI18n().getProperty(C.I18N_KEYS.METRICS_TITLE)||"JWT Validation Metrics"}</h3>
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
    `,t=document.getElementById("metrics");if(b.info("Metrics tab pane found:",!!t),t)b.info("Appending metrics content to tab pane"),t.innerHTML=e,b.info("Metrics content appended, new length:",t.innerHTML.length);else{b.warn("Metrics tab pane not found, appending to container");const i=document.getElementById("jwt-validator-container");i&&i.insertAdjacentHTML("beforeend",e)}const s=document.getElementById("refresh-metrics-btn");s&&s.addEventListener("click",q)};let R=null,xe=!0;const Gt=()=>{q(),typeof jest>"u"&&(R=setInterval(q,1e4))},q=async()=>{if(b.debug("Refreshing metrics"),!xe){b.debug("Metrics endpoint not available, skipping refresh");return}try{const e=await Yt();Xt(e)}catch(e){b.error("Failed to refresh metrics:",e),Zt()}},Yt=async()=>{try{const e=await vt(),t=e.totalTokensValidated||0,s=e.validTokens||0,i=e.invalidTokens||0;return{totalValidations:t,successCount:s,failureCount:i,avgResponseTime:e.averageResponseTime||0,activeIssuers:e.activeIssuers||0,issuerMetrics:e.issuerMetrics||[],recentErrors:e.topErrors||[]}}catch(e){return b.error("Failed to fetch metrics from API:",e),e.status===404&&(b.info("Metrics endpoint not available (404), showing placeholder data"),xe=!1,Qt()),{totalValidations:0,successCount:0,failureCount:0,avgResponseTime:0,activeIssuers:0,issuerMetrics:[],recentErrors:[]}}},Xt=e=>{const t=document.getElementById("total-validations");t&&(t.textContent=je(e.totalValidations));const s=e.totalValidations>0?e.successCount/e.totalValidations:0,i=document.getElementById("success-rate");i&&(i.textContent=Ue(s));const n=document.getElementById("avg-response-time");n&&(n.textContent=`${e.avgResponseTime}ms`);const o=document.getElementById("active-issuers");o&&(o.textContent=e.activeIssuers);const r=e.issuerMetrics.map(c=>`
        <div class="issuer-metric-item">
            <div class="issuer-name">${c.name}</div>
            <div class="issuer-stats">
                <span class="stat">Validations: ${je(c.validations)}</span>
                <span class="stat">Success Rate: 
                ${Ue(c.successRate/100)}</span>
                <span class="stat">Last: ${Ve(c.lastValidation)}</span>
            </div>
        </div>
    `).join(""),a=document.getElementById("issuer-metrics-list");if(a&&(a.innerHTML=r||'<div class="no-data">No issuer data available</div>'),e.recentErrors.length>0){const c=e.recentErrors.map(m=>`
            <div class="error-metric-item">
                <div class="error-details">
                    <span class="error-issuer">${m.issuer}</span>
                    <span class="error-message">${m.error}</span>
                    <span class="error-count">(${m.count} occurrences)</span>
                </div>
                <div class="error-time">${Ve(m.timestamp)}</div>
            </div>
        `).join(""),d=document.getElementById("error-metrics-list");d&&(d.innerHTML=c)}else{const c=document.getElementById("error-metrics-list");c&&(c.innerHTML='<div class="no-errors">No recent errors</div>')}},Zt=()=>{const e=document.getElementById("jwt-metrics-content");e&&(e.innerHTML=`
            <div class="metrics-error">
                <i class="fa fa-exclamation-triangle"></i>
                <p>Unable to load metrics. Please try again later.</p>
                <button onclick="location.reload()">Reload Page</button>
            </div>
        `)},Qt=()=>{const e=document.getElementById("jwt-metrics-content");e&&(e.innerHTML=`
            <div class="metrics-not-available">
                <i class="fa fa-info-circle"></i>
                <h3>Metrics Not Available</h3>
                <p>The metrics endpoint is not currently implemented.</p>
                <p>Metrics functionality will be available in a future release.</p>
            </div>
        `),R&&(clearInterval(R),R=null)},es=()=>{b.debug("Cleaning up metrics tab"),R&&(clearInterval(R),R=null)},ts=()=>g.getI18n().getProperty(C.I18N_KEYS.METRICS_TAB_NAME)||"Metrics";window.metricsTab={refreshMetrics:q};const Pe=Object.freeze(Object.defineProperty({__proto__:null,cleanup:es,getDisplayName:ts,init:ie},Symbol.toStringTag,{value:"Module"})),L=B("HelpTab"),ne=()=>{L.info("Initializing help tab"),document.getElementById("jwt-help-content")?L.info("Help tab content already exists, skipping creation"):(L.info("Creating help tab content..."),ss(),is())},ss=()=>{const e=`
        <div id="jwt-help-content" class="jwt-tab-content help-tab" data-testid="help-tab-content">
            <div class="help-header">
                <h3>${g.getI18n().getProperty(C.I18N_KEYS.HELP_TITLE)||"JWT Authenticator Help"}</h3>
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
    `,t=document.getElementById("help");if(L.info("Help tab pane found:",!!t),t)L.info("Appending help content to tab pane"),t.innerHTML=e,L.info("Help content appended, new length:",t.innerHTML.length);else{L.warn("Help tab pane not found, appending to container");const s=document.getElementById("jwt-validator-container");s&&s.insertAdjacentHTML("beforeend",e)}},is=()=>{document.querySelectorAll(".collapsible-header").forEach(e=>{e.addEventListener("click",function(){const t=this.nextElementSibling,s=this.querySelector("i.fa");this.classList.toggle("active"),t&&t.classList.contains("collapsible-content")&&t.classList.toggle("show"),s&&(this.classList.contains("active")?(s.classList.remove("fa-chevron-right"),s.classList.add("fa-chevron-down")):(s.classList.remove("fa-chevron-down"),s.classList.add("fa-chevron-right"))),L.debug("Toggled help section:",this.textContent.trim())})})},De=Object.freeze(Object.defineProperty({__proto__:null,cleanup:()=>{L.debug("Cleaning up help tab")},getDisplayName:()=>g.getI18n().getProperty(C.I18N_KEYS.HELP_TAB_NAME)||"Help",init:ne},Symbol.toStringTag,{value:"Module"}));let He="en";const $e=["en","de"],ns=function(){const t=(navigator.language||navigator.userLanguage||"en").split("-")[0];return $e.includes(t)?t:"en"},os=function(e){return $e.includes(e)?(He=e,!0):!1},rs=function(){return He};os(ns());function H(e,t={},s=document){var r;if(e==null)return null;let i;if(typeof e=="string"?i=s.querySelectorAll(e):Array.isArray(e)?i=e:i=[e],i.length===0)return null;const o={...{placement:"bottom-start",arrow:!0,theme:"light-border",appendTo:"parent"},...t};try{return Xe(Array.from(i),o)}catch(a){return(r=g==null?void 0:g.logError)==null||r.call(g,"Error initializing tooltip: "+a.message),null}}const as={"ctrl+enter":"verify-token","cmd+enter":"verify-token","alt+v":"verify-token","ctrl+1":"goto-tab-1","ctrl+2":"goto-tab-2","ctrl+3":"goto-tab-3","cmd+1":"goto-tab-1","cmd+2":"goto-tab-2","cmd+3":"goto-tab-3","ctrl+s":"save-form","cmd+s":"save-form","alt+r":"reset-form",escape:"close-dialog",f1:"show-help","?":"show-help"},Fe=new Map,Be=()=>{We(),document.addEventListener("keydown",ze),window.__keyboardShortcutHandler=ze,gs()},ze=e=>{const t=Je(e),s=as[t];s&&cs(e)&&(e.preventDefault(),e.stopPropagation(),ls(s))},Je=e=>{const t=[];(e.ctrlKey||e.metaKey)&&t.push(e.ctrlKey?"ctrl":"cmd"),e.altKey&&t.push("alt"),e.shiftKey&&t.push("shift");const s=e.key?e.key.toLowerCase():"";return s==="enter"?t.push("enter"):s==="escape"?t.push("escape"):s==="f1"?t.push("f1"):s&&s.match(/^[a-z0-9?]$/)&&t.push(s),t.join("+")},cs=e=>{const t=e.target,s=t.tagName?t.tagName.toLowerCase():"";if(s==="input"||s==="textarea"){const i=Je(e);return i==="ctrl+enter"||i==="cmd+enter"||i==="escape"}return!0},ls=e=>{if(e!=null&&e.startsWith("custom-")){const t=Fe.get(e);if(t&&t.handler){t.handler();return}}switch(e){case"verify-token":ds();break;case"goto-tab-1":case"goto-tab-2":case"goto-tab-3":us(parseInt(e.split("-")[2])-1);break;case"save-form":ps();break;case"reset-form":fs();break;case"close-dialog":ms();break;case"show-help":hs();break;default:console.debug("Unknown keyboard shortcut action:",e)}},ds=()=>{const e=document.querySelector(".verify-token-button:not(:disabled)");e&&e.offsetParent!==null&&(e.click(),$("Token verification started"))},us=e=>{const t=document.querySelectorAll(".tab-nav-item");t.length>e&&(t[e].click(),$(`Switched to tab ${e+1}`))},ps=()=>{const t=Array.from(document.querySelectorAll("button:not(:disabled)")).find(s=>s.offsetParent!==null&&(s.textContent.includes("Save")||s.textContent.includes("Apply")));t&&(t.click(),$("Form save triggered"))},fs=()=>{const t=Array.from(document.querySelectorAll("button:not(:disabled)")).find(s=>s.offsetParent!==null&&(s.textContent.includes("Reset")||s.textContent.includes("Clear")));t&&(t.click(),$("Form reset triggered"))},ms=()=>{const e=document.querySelector(".ui-dialog-titlebar-close")||Array.from(document.querySelectorAll("button")).find(t=>t.offsetParent!==null&&(t.textContent.includes("Cancel")||t.textContent.includes("Close")));e&&(e.click(),$("Dialog closed"))},hs=()=>{const t=`
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
    `,s=document.createElement("div");s.innerHTML=t;const i=s.firstElementChild;document.body.appendChild(i);const n=()=>i.remove();i.querySelector(".close-help-btn").addEventListener("click",n),i.querySelector(".modal-overlay").addEventListener("click",n)},$=e=>{const t=document.createElement("div");t.className="keyboard-action-feedback",t.textContent=e,document.body.appendChild(t),setTimeout(()=>{t.classList.add("fade-out"),setTimeout(()=>t.remove(),300)},2e3)},gs=()=>{sessionStorage.getItem("nifi-jwt-shortcuts-shown")||setTimeout(()=>{const e=`
            <div class="shortcuts-hint">
                <span>💡 Press <kbd>F1</kbd> or <kbd>?</kbd> for keyboard shortcuts</span>
                <button class="close-hint">×</button>
            </div>
        `,t=document.createElement("div");t.innerHTML=e;const s=t.firstElementChild;document.body.appendChild(s),s.querySelector(".close-hint").addEventListener("click",()=>s.remove()),setTimeout(()=>{s.classList.add("fade-out"),setTimeout(()=>s.remove(),300)},5e3),sessionStorage.setItem("nifi-jwt-shortcuts-shown","true")},2e3)},We=()=>{window.__keyboardShortcutHandler&&(document.removeEventListener("keydown",window.__keyboardShortcutHandler),delete window.__keyboardShortcutHandler),Fe.clear(),document.querySelectorAll(".keyboard-shortcuts-modal, .keyboard-action-feedback, .shortcuts-hint").forEach(e=>e.remove())},oe=B("tabManager"),qe=()=>{oe.debug("Initializing tab manager");const e=new WeakMap,t=s=>{const i=s.target.closest(".jwt-tabs-header .tabs a"),n=s.target.closest('[data-toggle="tab"]'),o=i||n;if(!o||(s.preventDefault(),n&&e.get(o)))return;n&&(e.set(o,!0),setTimeout(()=>e.delete(o),100));const r=o.getAttribute("href")||o.getAttribute("data-target");if(!r||r==="#")return;document.querySelectorAll(".jwt-tabs-header .tabs li").forEach(c=>c.classList.remove("active")),o.parentElement&&o.parentElement.classList.add("active"),document.querySelectorAll(".tab-pane").forEach(c=>c.classList.remove("active"));const a=document.querySelector(r);a&&a.classList.add("active"),oe.debug("Switched to tab:",r),document.dispatchEvent(new CustomEvent("tabChanged",{detail:{tabId:r,tabName:o.textContent.trim()}}))};document.addEventListener("click",t),window.__tabClickHandler=t},vs=()=>{window.__tabClickHandler&&(document.removeEventListener("click",window.__tabClickHandler),delete window.__tabClickHandler),oe.debug("Tab manager cleaned up")},l=B("NiFi-Main"),Es=()=>{try{rs();const e=window.location.href.includes("nifi-cuioss-ui")||window.location.href.includes("localhost:9095")||window.location.pathname.includes("/nifi-cuioss-ui");return typeof g.registerCustomUiTab=="function"&&!e?(g.registerCustomUiTab(M.COMPONENT_TABS.ISSUER_CONFIG,Me),g.registerCustomUiTab(M.COMPONENT_TABS.TOKEN_VERIFICATION,Ee),g.registerCustomUiTab(M.COMPONENT_TABS.METRICS,Pe),g.registerCustomUiTab(M.COMPONENT_TABS.HELP,De)):l.info("Skipping tab registration in standalone mode"),window.jwtComponentsRegistered=!0,!0}catch(e){return console.error("JWT UI component registration failed:",e),!1}},re=()=>{try{document.querySelectorAll(f.SELECTORS.PROPERTY_LABEL).forEach(e=>{const t=e.textContent.trim(),s=C.PROPERTY_LABELS[t];if(s&&!e.querySelector(f.SELECTORS.HELP_TOOLTIP)){const i=g.getI18n().getProperty(s);if(i){const n=document.createElement("span");n.className=`${f.CLASSES.HELP_TOOLTIP} ${f.CLASSES.FA} ${f.CLASSES.FA_QUESTION_CIRCLE}`,n.setAttribute("title",i),e.appendChild(n)}}}),H(f.SELECTORS.HELP_TOOLTIP),H("[title]",{placement:"bottom"}),H(".help-tooltip",{placement:"right"}),bs(),Ts()}catch(e){l.debug("JWT UI help tooltips setup failed:",e)}},Ts=()=>{if(typeof MutationObserver<"u"){const t=new MutationObserver(s=>{let i=!1;s.forEach(n=>{n.type==="childList"&&n.addedNodes.forEach(o=>{var r;if(o.nodeType===Node.ELEMENT_NODE){const a=((r=o.textContent)==null?void 0:r.trim())||"";(a.includes("Loading JWT")||a.includes("Loading Validator")||a.includes("Loading JWT Validator UI"))&&(i=!0)}})}),i&&(l.debug("MutationObserver detected loading message, hiding immediately"),_())});t.observe(document.body,{childList:!0,subtree:!0,characterData:!0}),window.jwtLoadingObserver=t}const e=setInterval(()=>{var s,i;((i=(s=document.querySelector("*"))==null?void 0:s.innerText)==null?void 0:i.includes("Loading JWT Validator UI"))&&(l.debug("Periodic check detected loading message, hiding immediately"),_())},100);setTimeout(()=>{clearInterval(e),l.debug("Periodic loading check completed")},1e4),l.debug("Continuous loading monitoring set up successfully")},bs=()=>{try{const e=new MutationObserver(t=>{t.forEach(s=>{s.type==="childList"&&s.addedNodes.forEach(i=>{if(i.nodeType===Node.ELEMENT_NODE){const n=i.querySelectorAll("[title]"),o=i.querySelectorAll(".help-tooltip");n.length>0&&H(Array.from(n),{placement:"bottom"}),o.length>0&&H(Array.from(o),{placement:"right"})}})})});e.observe(document.body,{childList:!0,subtree:!0}),window.nifiJwtTooltipObserver||(window.nifiJwtTooltipObserver=e)}catch(e){console.debug("Failed to setup tooltip observer:",e)}},K=()=>{try{const e=document.getElementById(f.IDS.LOADING_INDICATOR);if(e)e.style.display="none",e.style.visibility="hidden",e.setAttribute("aria-hidden","true"),e.classList.add("hidden"),e.style.removeProperty&&(e.style.removeProperty("display"),e.style.display="none"),l.debug("Loading indicator successfully hidden");else{const s=document.querySelector('#loading-indicator, .loading-indicator, [id*="loading"]');s&&(s.style.display="none",s.style.visibility="hidden")}const t=document.getElementById(f.IDS.JWT_VALIDATOR_TABS);t&&(t.style.display="",t.style.visibility="visible"),ae(),window.jwtUISetupComplete=!0}catch(e){console.error("Error in setupUI():",e);try{const t=document.getElementById("loading-indicator");t&&(t.style.display="none")}catch(t){console.error("Even fallback setupUI failed:",t)}}},ae=()=>{const e=g.getI18n(),t=document.getElementById(f.IDS.LOADING_INDICATOR);t&&(t.textContent=e.getProperty(C.I18N_KEYS.JWT_VALIDATOR_LOADING)||"Loading...");const s=document.querySelector(f.SELECTORS.JWT_VALIDATOR_TITLE);s&&(s.textContent=e.getProperty(C.I18N_KEYS.JWT_VALIDATOR_TITLE)||"JWT Validator")},ys=()=>{document.addEventListener("dialogOpen",e=>{var n;const t=e.detail,s=Array.isArray(t)?t[0]:t;((n=s==null?void 0:s.classList)==null?void 0:n.contains(f.CLASSES.PROCESSOR_DIALOG))&&setTimeout(()=>{var r,a;const o=(a=(r=s.querySelector(f.SELECTORS.PROCESSOR_TYPE))==null?void 0:r.textContent)==null?void 0:a.trim();o!=null&&o.includes(M.PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR)&&(re(),ae())},J.TIMEOUTS.DIALOG_DELAY)})},Ke=()=>{try{l.info("Initializing tab content components..."),l.info("Initializing issuer config tab");const e=document.getElementById("issuer-config");if(e){const s=()=>l.debug("Issuer config initialized"),i=window.location.href;se(e,s,i)}else l.warn("Issuer config tab element not found");l.info("Initializing token verification tab");const t=document.getElementById("token-verification");t?Q(t,{},"jwt",()=>l.debug("Token verifier initialized")):l.warn("Token verification tab element not found"),l.info("Initializing metrics tab"),ie(),l.info("Initializing help tab"),ne(),document.addEventListener("tabChanged",s=>{const i=s.detail;switch(l.debug("Tab changed to:",i.tabId),i.tabId){case"#issuer-config":{const n=document.getElementById("issuer-config");if(n){const o=()=>l.debug("Issuer config re-initialized"),r=window.location.href;se(n,o,r)}break}case"#token-verification":{const n=document.getElementById("token-verification");n&&Q(n,{},"jwt",()=>l.debug("Token verifier re-initialized"));break}case"#metrics":ie();break;case"#help":ne();break;default:l.warn("Unknown tab:",i.tabId)}}),l.info("Tab content initialization setup complete")}catch(e){l.error("Failed to initialize tab content:",e)}},Is=()=>new Promise(e=>{try{if(l.debug("JWT UI initialization starting..."),window.jwtInitializationInProgress||window.jwtUISetupComplete){l.debug("Initialization already in progress or complete, skipping"),e(!0);return}window.jwtInitializationInProgress=!0,l.info("PRIORITY: Hiding loading indicator immediately"),_(),l.debug("Registering JWT UI components...");const t=Es();t?(l.debug("Component registration successful, setting up UI..."),K(),qe(),le(),ys(),Be(),Ke(),l.info("JWT UI initialization completed successfully")):(console.warn("Component registration failed, using fallback..."),K(),qe(),le(),Be(),Ke()),setTimeout(()=>{l.debug("100ms safety check: ensuring loading indicator is hidden"),_()},100),setTimeout(()=>{l.debug("500ms safety check: ensuring loading indicator is hidden"),_()},500),setTimeout(()=>{l.debug("Final 1s fallback: ensuring UI is visible and loading hidden"),K(),_(),ae()},J.TIMEOUTS.DIALOG_DELAY),window.jwtInitializationInProgress=!1,e(t)}catch(t){console.error("JWT UI initialization failed:",t),_(),K(),window.jwtInitializationInProgress=!1,e(!1)}}),_=()=>{try{l.debug("hideLoadingIndicatorRobust: Starting comprehensive loading indicator removal"),ws(),Ss(),Ls(),window.jwtLoadingIndicatorHidden=!0,window.jwtHideLoadingIndicator=_,l.debug("hideLoadingIndicatorRobust: Comprehensive loading indicator removal completed")}catch(e){console.warn("Error in hideLoadingIndicatorRobust:",e),Ye()}},ws=()=>{const e=document.getElementById(f.IDS.LOADING_INDICATOR);if(e){const t=e.textContent;e.style.setProperty("display","none","important"),e.style.setProperty("visibility","hidden","important"),e.style.setProperty("opacity","0","important"),e.setAttribute("aria-hidden","true"),e.classList.add("hidden"),e.textContent="",e.innerHTML="",l.debug(`Loading indicator hidden via standard ID (was: "${t}")`)}},Ss=()=>{["#loading-indicator",".loading-indicator",'[id*="loading"]','[class*="loading"]'].forEach(t=>{try{document.querySelectorAll(t).forEach(i=>{i.style.setProperty("display","none","important"),i.style.setProperty("visibility","hidden","important"),i.style.setProperty("opacity","0","important"),i.setAttribute("aria-hidden","true"),i.classList.add("hidden")})}catch(s){console.debug("Selector ignored:",t,s)}})},Ls=()=>{var n;const e=document.getElementsByTagName("*"),t=["Loading JWT Validator UI","Loading JWT","Loading"];let s=0;l.debug("hideLoadingByTextContent: Starting scan of",e.length,"elements");for(const o of e){const r=((n=o.textContent)==null?void 0:n.trim())||"";t.some(c=>r.includes(c))&&(l.debug("Found element with loading text:",r,"on element:",o.tagName,o.id,o.className),Ge(r)?(ce(o,r),s++):l.debug("Element not hidden because shouldHideElement returned false"))}["loading-indicator","simulated-loading","jwt-loading","validator-loading"].forEach(o=>{var a,c;const r=document.getElementById(o);r&&(l.debug(`Found element with ID ${o}:`,(a=r.textContent)==null?void 0:a.trim()),(c=r.textContent)!=null&&c.trim().includes("Loading")&&(ce(r,r.textContent.trim()),s++))}),l.debug(`hideLoadingByTextContent: Hidden ${s} loading indicators`)},Ge=e=>{l.debug("shouldHideElement checking:",e);const t=e.length<100&&(e==="Loading JWT Validator UI..."||e.startsWith("Loading JWT")||e.startsWith("Loading"));return l.debug("shouldHideElement result:",t),t},ce=(e,t)=>{e.style.setProperty("display","none","important"),e.style.setProperty("visibility","hidden","important"),e.style.setProperty("opacity","0","important"),e.setAttribute("aria-hidden","true"),e.classList.add("hidden"),e.childNodes.length===1&&e.childNodes[0].nodeType===Node.TEXT_NODE&&(e.textContent=""),l.debug(`Hidden element with loading text: "${t}"`)},Ye=()=>{try{const e=document.getElementById("loading-indicator");e&&(e.style.display="none",l.debug("Emergency fallback: basic loading indicator hidden"))}catch(e){console.error("Even emergency fallback failed:",e)}},_s=()=>{try{We(),vs(),window.nifiJwtTooltipObserver&&(window.nifiJwtTooltipObserver.disconnect(),window.nifiJwtTooltipObserver=null),window.jwtLoadingObserver&&(window.jwtLoadingObserver.disconnect(),window.jwtLoadingObserver=null)}catch(e){console.debug(e)}},ks=()=>[{id:"issuer-config-editor",status:"registered"},{id:"token-verifier",status:"registered"},{id:"help-tooltips",status:"registered"}],le=re;p.cleanup=_s,p.emergencyFallbackHideLoading=Ye,p.getComponentStatus=ks,p.helpTab=De,p.hideElement=ce,p.hideLoadingIndicatorRobust=_,p.init=Is,p.issuerConfigEditor=Me,p.metricsTab=Pe,p.registerHelpTooltips=le,p.setupHelpTooltips=re,p.shouldHideElement=Ge,p.tokenVerifier=Ee,Object.defineProperty(p,Symbol.toStringTag,{value:"Module"})});
