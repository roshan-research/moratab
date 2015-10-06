# coding: utf8

from __future__ import unicode_literals
import re
from mistune import Renderer, escape
from .math import MarkdownWithMath

ltr = re.compile(r'[ <>*+\t\n\\\/\[\]\(\)0-9\._-]*[A-Za-z]')
refine = lambda html: refine(html[html.find('>')+1:]) if html.startswith('<') else html
direction = lambda html: ' dir="ltr"' if ltr.match(refine(html)) else ''
number_translation = dict((ord(a), b) for a, b in zip('1234567890', '۱۲۳۴۵۶۷۸۹۰'))


class Moratab(Renderer):
	def header_number(self, level):
		max_level = 3
		if not self.header_numbers or level > max_level:
			return ''

		self.last_header = self.last_header[:level] + [0]*(max_level - level + 1)
		self.last_header[level-1] += 1

		if self.last_header[0] == 0:
			return ''

		return '<span>%s</span>' % ('.'.join(map(str, self.last_header[:level])) + '. ').translate(number_translation)

	def header(self, text, level, raw=None):
		return '<h%d%s>%s</h%d>\n' % (level, direction(text), self.header_number(level) + text, level)

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


markdown = MarkdownWithMath(renderer=Moratab(), hard_wrap=True)


def append_simple_footnotes(text):
	for footnote in re.finditer(r'\[\^([^\]]+)\]', text):
		ref = footnote.group(1)

		if not '[^{0}]:'.format(ref) in text:
			text += '\n[^{0}]: {0}'.format(ref)

	return text


def render(text, header_numbers=False):
	text = append_simple_footnotes(text)
	markdown.renderer.header_numbers = header_numbers
	markdown.renderer.last_header = []
	return markdown.render(text)
