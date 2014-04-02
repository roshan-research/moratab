
/* parser customization */

var moratab = new marked.Renderer();

var ltr = /^[ <>*+\t\n\\\/\[\($-]*[A-Za-z]/;
var direction = function(html) {
	elm = document.createElement('span');
	elm.innerHTML = html;
	text = elm.textContent;
	return ltr.test(text) ? ' dir="ltr"' : '';
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
