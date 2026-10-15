window.Store = {
  get(k,f=null){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(_){return f}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))},
  remove(k){localStorage.removeItem(k)}
};
