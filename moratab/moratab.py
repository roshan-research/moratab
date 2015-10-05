
from __future__ import unicode_literals
import re
from mistune import Renderer, escape
from .math import MarkdownWithMath, MathInlineLexer, MathBlockLexer

ltr = re.compile(r'[ <>*+\t\n\\\/\[\]\(\)0-9\._-]*[A-Za-z]')
refine = lambda html: refine(html[html.find('>')+1:]) if html.startswith('<') else html
direction = lambda html: ' dir="ltr"' if ltr.match(refine(html)) else ''


class Moratab(Renderer):
	def header(self, text, level, raw=None):
		return '<h%d%s>%s</h%d>\n' % (level, direction(text), text, level)

	def paragraph(self, text):
		return '<p%s>%s</p>\n' % (direction(text), text)

	def list_item(self, text):
		return '<li%s><p>%s</p></li>\n' % (direction(text), text)

	def image(self, src, title, text):
		caption = '<figcaption>{0}</figcaption>'.format(text) if text else ''
		return '<figure><img src="{0}" alt="{1}">{2}</figure>'.format(src, text, caption)

	def block_quote(self, text):
		return '<blockquote%s>%s\n</blockquote>' % (direction(text), text)

	def table_cell(self, content, **flags):
		tag = 'th' if flags['header'] else 'td'
		align = flags['align']
		if not align:
			return '<%s>%s</%s>\n' % (tag, content, tag)
		return '<%s align="%s">%s</%s>\n' % (tag, align, content, tag)

	def footnote_item(self, key, text):
		return '<li%s id="fn-%s">%s</li>\n' % (direction(text), escape(key), text)

	def inline_math(self, text):
		return '<span class="math" dir="ltr">%s</span>' % text.strip()

	def block_math(self, text):
		return '<div class="math" dir="ltr">%s</div>' % text.strip()

	def latex_environment(self, name, text):
		return r'\begin{%s}%s\end{%s}' % (name, text, name)


renderer = Moratab()
markdown = MarkdownWithMath(renderer=renderer, hard_wrap=True, inline=MathInlineLexer(renderer), block=MathBlockLexer())


def append_simple_footnotes(text):
	for footnote in re.finditer(r'\[\^([^\]]+)\]', text):
		ref = footnote.group(1)

		if not '[^{0}]:'.format(ref) in text:
			text += '\n[^{0}]: {0}'.format(ref)

	return text


def render(text):
	text = append_simple_footnotes(text)
	return markdown.render(text)
