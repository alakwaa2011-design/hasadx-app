function n(t){if(!t)return null;if(t.startsWith("/objects/"))return`/api${t}`;const e=t.match(/\/api(\/objects\/.+)$/);return e?`/api${e[1]}`:t}export{n as r};
