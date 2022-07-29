
from setuptools import setup

setup(name='moratab',
	version='0.5.2',
	description='Persian markdown convertor.',
	author='Alireza Nourian',
	author_email='az.nourian@gmail.com',
	url='http://www.sobhe.ir/moratab/',
	packages=['moratab'],
	classifiers=[
		'Natural Language :: Persian',
		'Programming Language :: Python :: 2.7',
		'License :: OSI Approved :: MIT License',
	],
	install_requires=['mistune==2.0.3']
)
