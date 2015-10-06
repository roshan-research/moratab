# coding: utf-8

"""
	Support Math features for mistune.

	:copyright: (c) 2014 by Hsiaoming Yang.
"""

import re, mistune


class MathBlockGrammar(mistune.BlockGrammar):
	block_math = re.compile(r"^\$\$(.*?)\$\$", re.DOTALL)
	latex_environment = re.compile(r"^\\begin\{([a-z]*\*?)\}(.*?)\\end\{\1\}", re.DOTALL)

class MathBlockLexer(mistune.BlockLexer):
	default_rules = ['block_math', 'latex_environment'] + mistune.BlockLexer.default_rules

	def __init__(self, rules=None, **kwargs):
		if rules is None:
			rules = MathBlockGrammar()
		super(MathBlockLexer, self).__init__(rules, **kwargs)

	def parse_block_math(self, m):
		"""Parse a $$math$$ block"""
		self.tokens.append({
			'type': 'block_math',
			'text': m.group(1)
		})

	def parse_latex_environment(self, m):
		self.tokens.append({
			'type': 'latex_environment',
			'name': m.group(1),
			'text': m.group(2)
		})


class MathInlineGrammar(mistune.InlineGrammar):
	math = re.compile(r"^\$(.+?)\$", re.DOTALL)
	block_math = re.compile(r"^\$\$(.+?)\$\$", re.DOTALL)
	text = re.compile(r'^[\s\S]+?(?=[\\<!\[_*`~$]|https?://| {2,}\n|$)')


class MathInlineLexer(mistune.InlineLexer):
	default_rules = ['block_math', 'math'] + mistune.InlineLexer.default_rules

	def __init__(self, renderer, rules=None, **kwargs):
		if rules is None:
			rules = MathInlineGrammar()

			# hard_wrap fix
			rules.linebreak = re.compile(r'^ *\n(?!\s*$)')
			rules.text = re.compile(r'^[\s\S]+?(?=[\\<!\[_*`~$]|https?://| *\n|$)')

		super(MathInlineLexer, self).__init__(renderer, rules, **kwargs)

	def output_math(self, m):
		return self.renderer.inline_math(m.group(1))

	def output_block_math(self, m):
		return self.renderer.block_math(m.group(1))


class MarkdownWithMath(mistune.Markdown):
	def __init__(self, renderer, **kwargs):
		if 'inline' not in kwargs:
			kwargs['inline'] = MathInlineLexer
		if 'block' not in kwargs:
			kwargs['block'] = MathBlockLexer
		super(MarkdownWithMath, self).__init__(renderer, **kwargs)

	def output_block_math(self):
		return self.renderer.block_math(self.token['text'])

	def output_latex_environment(self):
		return self.renderer.latex_environment(self.token['name'], self.token['text'])
