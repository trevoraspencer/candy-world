'use strict';
const CandyEvents=(()=>{const listeners=new Map();return{on(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);return()=>listeners.get(type)?.delete(fn);},emit(type,detail){for(const fn of listeners.get(type)||[]){try{fn(detail||{});}catch(error){console.warn('Candy event listener failed for '+type+':',error);}}}};})();
