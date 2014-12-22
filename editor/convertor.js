
// reMarked.js@f7f167
reMarked=function(opts){function extend(e,t){if(!t)return e;for(var n in e)typeOf(t[n])=="Object"?extend(e[n],t[n]):typeof t[n]!="undefined"&&(e[n]=t[n])}function typeOf(e){return Object.prototype.toString.call(e).slice(8,-1)}function rep(e,t){var n="";while(t-->0)n+=e;return n}function trim12(e){var e=e.replace(/^\s\s*/,""),t=/\s/,n=e.length;while(t.test(e.charAt(--n)));return e.slice(0,n+1)}function lpad(e,t,n){return rep(t,n-e.length)+e}function rpad(e,t,n){return e+rep(t,n-e.length)}function otag(e,t){if(!e)return"";var n="<"+e;for(var r,i=0;i<t.attributes.length;i++)r=t.attributes.item(i),n+=" "+r.nodeName+'="'+r.nodeValue+'"';return n+">"}function ctag(e){return e?"</"+e+">":""}function pfxLines(e,t){return e.replace(/^/gm,t)}function nodeName(e){return(e.nodeName=="#text"?"txt":e.nodeName).toLowerCase()}function wrap(e,t){var n,r;return t instanceof Array?(n=t[0],r=t[1]):n=r=t,n=n instanceof Function?n.call(this,e):n,r=r instanceof Function?r.call(this,e):r,n+e+r}function outerHTML(e){return e.outerHTML||function(e){var t=document.createElement("div"),n;return t.appendChild(e.cloneNode(!0)),n=t.innerHTML,t=null,n}(e)}var links=[],cfg={link_list:!1,h1_setext:!0,h2_setext:!0,h_atx_suf:!1,gfm_code:["```","~~~"][0],trim_code:!0,li_bullet:"*-+"[0],hr_char:"-_*"[0],indnt_str:["    ","	","  "][0],bold_char:"*_"[0],emph_char:"*_"[1],gfm_del:!0,gfm_tbls:!0,tbl_edges:!1,hash_lnks:!1,br_only:!1,col_pre:"col ",nbsp_spc:!1,span_tags:!0,div_tags:!0,unsup_tags:{ignore:"script style noscript",inline:"span sup sub i u b center big",block2:"div form fieldset dl header footer address article aside figure hgroup section",block1c:"dt dd caption legend figcaption output",block2c:"canvas audio video iframe"},tag_remap:{i:"em",b:"strong"}},isIE=eval("/*@cc_on!@*/!1"),docMode=document.documentMode,ieLt9=isIE&&(!docMode||docMode<9),textContProp="textContent"in Element.prototype||!ieLt9?"textContent":"innerText";extend(cfg,opts),this.render=function(e){links=[];var t=document.createElement("div");t.innerHTML=typeof e=="string"?e:outerHTML(e);var n=new lib.tag(t,null,0),r=n.rend().replace(/^[\t ]+[\n\r]+/gm,"\n").replace(/^[\n\r]+|[\n\r]+$/g,"");if(cfg.link_list&&links.length>0){r+="\n\n";var i=0;for(var s=0;s<links.length;s++){if(!links[s].e.title)continue;var o=links[s].e.href.length;o&&o>i&&(i=o)}for(var u=0;u<links.length;u++){var a=links[u].e.title?rep(" ",i+2-links[u].e.href.length)+'"'+links[u].e.title+'"':"";r+="  ["+(+u+1)+"]: "+(nodeName(links[u].e)=="a"?links[u].e.href:links[u].e.src)+a+"\n"}}return r.replace(/^[\t ]+\n/gm,"\n")};var lib={};lib.tag=klass({wrap:"",lnPfx:"",lnInd:0,init:function(e,t,n){this.e=e,this.p=t,this.i=n,this.c=[],this.tag=nodeName(e),this.initK()},initK:function(){var e;if(this.e.hasChildNodes()){var t=cfg.unsup_tags.inline,n,r;if(nodeName(this.e)=="table"&&this.e.hasChildNodes()&&!this.e.tHead){var i=document.createElement("thead"),s=this.e.tBodies[0],o=s.rows[0],u=o.cells[0];if(nodeName(u)=="th")i.appendChild(o);else{var a,e=0,f=o.cells.length,l=i.insertRow();while(e++<f)a=document.createElement("th"),a[textContProp]=cfg.col_pre+e,l.appendChild(a)}this.e.insertBefore(i,s)}for(e in this.e.childNodes){if(!/\d+/.test(e))continue;n=this.e.childNodes[e],r=nodeName(n),r in cfg.tag_remap&&(r=cfg.tag_remap[r]);if(cfg.unsup_tags.ignore.test(r))continue;if(r=="txt"&&!nodeName(this.e).match(t)&&/^\s+$/.test(n[textContProp])){if(e==0||e==this.e.childNodes.length-1)continue;var c=this.e.childNodes[e-1],h=this.e.childNodes[e+1];if(c&&!nodeName(c).match(t)||h&&!nodeName(h).match(t))continue}var p=null;if(!lib[r]){var d=cfg.unsup_tags;d.inline.test(r)?r=="span"&&!cfg.span_tags?r="inl":r="tinl":d.block2.test(r)?r=="div"&&!cfg.div_tags?r="blk":r="tblk":d.block1c.test(r)?r="ctblk":d.block2c.test(r)?(r="ctblk",p=["\n\n",""]):r="rawhtml"}var v=new lib[r](n,this,this.c.length);p&&(v.wrap=p);if(v instanceof lib.a&&n.href||v instanceof lib.img)v.lnkid=links.length,links.push(v);this.c.push(v)}}},rend:function(){return this.rendK().replace(/\n{3,}/gm,"\n\n")},rendK:function(){var e,t="";for(var n=0;n<this.c.length;n++)e=this.c[n],t+=(e.bef||"")+e.rend()+(e.aft||"");return t.replace(/^\n+|\n+$/,"")}}),lib.blk=lib.tag.extend({wrap:["\n\n",""],wrapK:null,tagr:!1,lnInd:null,init:function(e,t,n){this.supr(e,t,n),this.lnInd===null&&(this.p&&this.tagr&&this.c[0]instanceof lib.blk?this.lnInd=4:this.lnInd=0),this.wrapK===null&&(this.tagr&&this.c[0]instanceof lib.blk?this.wrapK="\n":this.wrapK="")},rend:function(){return wrap.call(this,(this.tagr?otag(this.tag,this.e):"")+wrap.call(this,pfxLines(pfxLines(this.rendK(),this.lnPfx),rep(" ",this.lnInd)),this.wrapK)+(this.tagr?ctag(this.tag):""),this.wrap)},rendK:function(){var e=this.supr();if(this.p instanceof lib.li){var t=null,n=e.match(/^[\t ]+/gm);if(!n)return e;for(var r=0;r<n.length;r++)if(t===null||n[r][0].length<t.length)t=n[r][0];return e.replace(new RegExp("^"+t),"")}return e}}),lib.tblk=lib.blk.extend({tagr:!0}),lib.cblk=lib.blk.extend({wrap:["\n",""]}),lib.ctblk=lib.cblk.extend({tagr:!0}),lib.inl=lib.tag.extend({rend:function(){var e=this.rendK(),t=e.match(/^((?: |\t|&nbsp;)*)(.*?)((?: |\t|&nbsp;)*)$/)||[e,"",e,""];return t[1]+wrap.call(this,t[2],this.wrap)+t[3]}}),lib.tinl=lib.inl.extend({tagr:!0,rend:function(){return otag(this.tag,this.e)+wrap.call(this,this.rendK(),this.wrap)+ctag(this.tag)}}),lib.p=lib.blk.extend({rendK:function(){return this.supr().replace(/^\s+/gm,"")}}),lib.list=lib.blk.extend({wrap:[function(){return this.p instanceof lib.li?"\n":"\n\n"},""]}),lib.ul=lib.list.extend({}),lib.ol=lib.list.extend({}),lib.li=lib.cblk.extend({wrap:["\n",function(e){return this.c[0]&&this.c[0]instanceof lib.p||e.match(/\n{2}/gm)?"\n":""}],wrapK:[function(){return this.p.tag=="ul"?cfg.li_bullet+" ":this.i+1+".  "},""],rendK:function(){return this.supr().replace(/\n([^\n])/gm,"\n"+cfg.indnt_str+"$1")}}),lib.hr=lib.blk.extend({wrap:["\n\n",rep(cfg.hr_char,3)]}),lib.h=lib.blk.extend({}),lib.h_setext=lib.h.extend({}),cfg.h1_setext&&(lib.h1=lib.h_setext.extend({wrapK:["",function(e){return"\n"+rep("=",e.length)}]})),cfg.h2_setext&&(lib.h2=lib.h_setext.extend({wrapK:["",function(e){return"\n"+rep("-",e.length)}]})),lib.h_atx=lib.h.extend({wrapK:[function(e){return rep("#",this.tag[1])+" "},function(e){return cfg.h_atx_suf?" "+rep("#",this.tag[1]):""}]}),!cfg.h1_setext&&(lib.h1=lib.h_atx.extend({})),!cfg.h2_setext&&(lib.h2=lib.h_atx.extend({})),lib.h3=lib.h_atx.extend({}),lib.h4=lib.h_atx.extend({}),lib.h5=lib.h_atx.extend({}),lib.h6=lib.h_atx.extend({}),lib.a=lib.inl.extend({lnkid:null,rend:function(){var e=this.rendK(),t=this.e.getAttribute("href"),n=this.e.title?' "'+this.e.title+'"':"";return!this.e.hasAttribute("href")||t==e||t[0]=="#"&&!cfg.hash_lnks?e:cfg.link_list?"["+e+"] ["+(this.lnkid+1)+"]":"["+e+"]("+t+n+")"}}),lib.img=lib.inl.extend({lnkid:null,rend:function(){var e=this.e.alt,t=this.e.getAttribute("src");if(cfg.link_list)return"!["+e+"] ["+(this.lnkid+1)+"]";var n=this.e.title?' "'+this.e.title+'"':"";return"!["+e+"]("+t+n+")"}}),lib.em=lib.inl.extend({wrap:cfg.emph_char}),lib.del=cfg.gfm_del?lib.inl.extend({wrap:"~~"}):lib.tinl.extend(),lib.br=lib.inl.extend({wrap:["",function(){var e=cfg.br_only?"<br>":"  ";return this.p instanceof lib.h?"<br>":e+"\n"}]}),lib.strong=lib.inl.extend({wrap:rep(cfg.bold_char,2)}),lib.blockquote=lib.blk.extend({lnPfx:"> ",rend:function(){return this.supr().replace(/>[ \t]$/gm,">")}}),lib.pre=lib.blk.extend({tagr:!0,wrapK:"\n",lnInd:0}),lib.code=lib.blk.extend({tagr:!1,wrap:"",wrapK:function(e){return e.indexOf("`")!==-1?"``":"`"},lnInd:0,init:function(e,t,n){this.supr(e,t,n);if(this.p instanceof lib.pre){this.p.tagr=!1;if(cfg.gfm_code){var r=this.e.getAttribute("class");r=(r||"").split(" ")[0],r.indexOf("lang-")===0&&(r=r.substr(5)),this.wrapK=[cfg.gfm_code+r+"\n","\n"+cfg.gfm_code]}else this.wrapK="",this.p.lnInd=4}},rendK:function(){if(this.p instanceof lib.pre){var e=this.e[textContProp];return cfg.trim_code?e.trim():e}return this.supr()}}),lib.table=cfg.gfm_tbls?lib.blk.extend({cols:[],init:function(e,t,n){this.supr(e,t,n),this.cols=[]},rend:function(){for(var e=0;e<this.c.length;e++)for(var t=0;t<this.c[e].c.length;t++)for(var n=0;n<this.c[e].c[t].c.length;n++)this.c[e].c[t].c[n].prep();return this.supr()}}):lib.tblk.extend(),lib.thead=cfg.gfm_tbls?lib.cblk.extend({wrap:["\n",function(e){var t="";for(var n=0;n<this.p.cols.length;n++){var r=this.p.cols[n],i=r.a[0]=="c"?":":" ",s=r.a[0]=="r"||r.a[0]=="c"?":":" ";t+=(n==0&&cfg.tbl_edges?"|":"")+i+rep("-",r.w)+s+(n<this.p.cols.length-1||cfg.tbl_edges?"|":"")}return"\n"+trim12(t)}]}):lib.ctblk.extend(),lib.tbody=cfg.gfm_tbls?lib.cblk.extend():lib.ctblk.extend(),lib.tfoot=cfg.gfm_tbls?lib.cblk.extend():lib.ctblk.extend(),lib.tr=cfg.gfm_tbls?lib.cblk.extend({wrapK:[cfg.tbl_edges?"| ":"",cfg.tbl_edges?" |":""]}):lib.ctblk.extend(),lib.th=cfg.gfm_tbls?lib.inl.extend({guts:null,wrap:[function(){var e=this.p.p.p.cols[this.i],t=this.i==0?"":" ",n,r=e.w-this.guts.length;switch(e.a[0]){case"r":n=rep(" ",r);break;case"c":n=rep(" ",Math.floor(r/2));break;default:n=""}return t+n},function(){var e=this.p.p.p.cols[this.i],t=this.i==this.p.c.length-1?"":" |",n,r=e.w-this.guts.length;switch(e.a[0]){case"r":n="";break;case"c":n=rep(" ",Math.ceil(r/2));break;default:n=rep(" ",r)}return n+t}],prep:function(){this.guts=this.rendK(),this.rendK=function(){return this.guts};var e=this.p.p.p.cols;e[this.i]||(e[this.i]={w:null,a:""});var t=e[this.i];t.w=Math.max(t.w||0,this.guts.length);var n=this.e.align||this.e.style.textAlign;n&&(t.a=n)}}):lib.ctblk.extend(),lib.td=lib.th.extend(),lib.txt=lib.inl.extend({initK:function(){this.c=this.e[textContProp].split(/^/gm)},rendK:function(){var e=this.c.join("").replace(/\r/gm,"");return this.p instanceof lib.code||this.p instanceof lib.pre||(e=e.replace(/^\s*([#*])/gm,function(e,t){return e.replace(t,"\\"+t)})),this.i==0&&(e=e.replace(/^\n+/,"")),this.i==this.p.c.length-1&&(e=e.replace(/\n+$/,"")),e.replace(/\u00a0/gm,cfg.nbsp_spc?" ":"&nbsp;")}}),lib.rawhtml=lib.blk.extend({initK:function(){this.guts=outerHTML(this.e)},rendK:function(){return this.guts}});for(var i in cfg.unsup_tags)cfg.unsup_tags[i]=new RegExp("^(?:"+(i=="inline"?"a|em|strong|img|code|del|":"")+cfg.unsup_tags[i].replace(/\s/g,"|")+")$")},!function(e,t,n){typeof define=="function"?define(n):typeof module!="undefined"?module.exports=n():t[e]=n()}("klass",this,function(){function e(e){return i.call(t(e)?e:function(){},e,1)}function t(e){return typeof e===o}function n(e,t,n){return function(){var r=this.supr;this.supr=n[a][e];var i={}.fabricatedUndefined,s=i;try{s=t.apply(this,arguments)}finally{this.supr=r}return s}}function r(e,r,i){for(var s in r)r.hasOwnProperty(s)&&(e[s]=t(r[s])&&t(i[a][s])&&u.test(r[s])?n(s,r[s],i):r[s])}function i(e,n){function i(){}function s(){this.init?this.init.apply(this,arguments):(n||f&&o.apply(this,arguments),l.apply(this,arguments))}i[a]=this[a];var o=this,u=new i,f=t(e),l=f?e:this,c=f?{}:e;return s.methods=function(e){return r(u,e,o),s[a]=u,this},s.methods.call(s,c).prototype.constructor=s,s.extend=arguments.callee,s[a].implement=s.statics=function(e,t){return e=typeof e=="string"?function(){var n={};return n[e]=t,n}():e,r(this,e,o),this},s}var s=this,o="function",u=/xyz/.test(function(){xyz})?/\bsupr\b/:/.*/,a="prototype";return e});

var reMarker = new reMarked({
	h1_setext: false,
	h2_setext: false,
	li_bullet: '+',
	indnt_str: '\t',
	col_pre: 'ستون ',
	tbl_edges: true,
	nbsp_spc: true,
	span_tags: false,
	div_tags: false,
});


var stripHtml = function(html) {
	html = html.replace('<meta http-equiv="content-type" content="text/html; charset=utf-8">', '')

	var dom = $('<div>'+ html +'</div>');
	var validTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'ul', 'ol', 'img', 'li', 'a', 'blockquote', 'pre', 'span', 'b', 'i', 'br', 'em', 'strong', 'code', 'table', 'thead', 'tbody', 'td', 'th', 'tr'];

	function clean(node) {
		node.removeAttr('class style lang dir title');

		if (node.attr('name') && node.attr('name').indexOf('_ftnref') == 0) {
			node.removeAttr('href');
			ref = node.text().replace(/\[(\d+)\]/, '[^$1]');
			node.html(ref);
		}
		else if (node.attr('name') && node.attr('name').indexOf('_ftn') == 0) {
			node.removeAttr('href');
			ref = node.text().replace(/\[(\d+)\]/, '[^$1]:');
			node.html(ref);
		}
	}
	function traverse(nodes) {
		nodes.each(function() {
			node = $(this);
			children = node.children();

			// remove empty nodes
			if (!node.text().trim().length && !(node[0].tagName == 'IMG' || node.find('img').length)) {
				node.remove();
				return;
			}

			if (validTags.indexOf(this.tagName.toLowerCase()) < 0) {
				children.unwrap();
				node.remove();
			}	else
				clean(node);
			traverse(children);
		});
	}

	traverse(dom.children());
	return dom.html().replace(/\n/g, ' ');
}

var htmlToMoratab = function(html) {
	stripped = stripHtml(html);
	return reMarker.render(stripped);
}
