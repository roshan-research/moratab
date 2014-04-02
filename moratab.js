
/* parser customization */

var moratab = new marked.Renderer();

var ltr = /^[ <>*+\t\n\\\/\[\($-]*[A-Za-z]/;
var refine = function(html) {
	return html[0] == '<' ? refine(html.substr(html.indexOf('>')+1)) : html;
}
var direction = function(html) {
	return ltr.test(refine(html)) ? ' dir="ltr"' : '';
}

moratab.paragraph = function(text) {
	return '<p'+ direction(text) +'>' + text + '</p>\n';
};
moratab.listitem = function(text) {
	return '<li'+ direction(text) +'>' + text + '</li>\n';
};
moratab.blockquote = function(quote) {
	return '<blockquote'+ direction(quote) +'>\n' + quote + '</blockquote>\n';
};
