
import re, mistune

ltr = re.compile(r'[ <>*+\t\n\\\/\[\($-]*[A-Za-z]')
refine = lambda html: refine(html[html.find('>')+1:]) if html.startswith('<') else html
direction = lambda html: ' dir="ltr"' if ltr.match(refine(html)) else ''


class Moratab(mistune.Renderer):
	def header(self, text, level, raw=None):
		return '<h%d%s>%s</h%d>\n' % (level, direction(text), text, level)

	def paragraph(self, text):
		return '<p%s>%s</p>\n' % (direction(text), text)

	def list_item(self, text):
		return '<li%s><p>%s</p></li>\n' % (direction(text), text)

	def block_quote(self, text):
		return '<blockquote%s>%s\n</blockquote>' % (direction(text), text)

	def table_cell(self, content, **flags):
		tag = 'th' if flags['header'] else 'td'
		align = flags['align']
		if not align:
			return '<%s>%s</%s>\n' % (tag, content, tag)
		return '<%s align="%s">%s</%s>\n' % (tag, align, content, tag)


markdown = mistune.Markdown(renderer=Moratab(), hard_wrap=True)


def replace_expressions(text):
	expressions = {}

	def expkey(match):
		key = 'x1x1x%dx' % (len(expressions)-1)
		expressions[key] = match.group(1)
		return key

	return re.sub(r'(\$\$?[^\$\n]+\$?\$)', expkey, text), expressions


def render(text):

	# remove expressions
	text, expressions = replace_expressions(text)

	# render text without expressions
	rendered = markdown.render(text)

	# add expressions
	for key, value in expressions.items():
		rendered = rendered.replace(key, value)

	return rendered
