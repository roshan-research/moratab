
/* parser customization */

var moratab = new marked.Renderer();

var ltr = /^[ <>*+\t\n\\\/\[\]\(\)0-9\._-]*[A-Za-z]/;
var refine = function(html) {
	return html[0] == '<' ? refine(html.substr(html.indexOf('>')+1)) : html;
}
var direction = function(html) {
	return ltr.test(refine(html)) ? ' dir="ltr"' : '';
}

moratab.heading = function(text, level, raw) {
	return '<h'+ level + direction(text)
		+' id="'+ this.options.headerPrefix + raw.toLowerCase().replace(/[^\w]+/g, '-')	+'">'
		+ text
		+ '</h'+ level +'>\n';
};
moratab.paragraph = function(text) {
	return '<p'+ direction(text) +'>' + text + '</p>\n';
};
moratab.listitem = function(text) {
	return '<li'+ direction(text) +'><p>' + text + '</p></li>\n';
};
moratab.blockquote = function(quote) {
	return '<blockquote'+ direction(quote) +'>\n' + quote + '</blockquote>\n';
};
moratab.tablecell = function(content, flags) {
	var type = flags.header ? 'th' : 'td';
	var tag = flags.align
		? '<' + type + ' align="' + flags.align + '">'
		: '<' + type + '>';
	return tag + content + '</' + type + '>\n';
};
