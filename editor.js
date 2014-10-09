// Credit to http://dabblet.com/
$.fn.stackedit = function () {

	var editor = {};
	var inputElt;
	var $inputElt;
	var contentElt;
	var $contentElt;
	var trailingLfNode;
	var defaultContent = 'Simple **StackEdit**.';

	/* Markdown Section Parser */
	var delimitersRegexp = '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+'; // Title delimiters
	delimitersRegexp = '^```.*\\n[\\s\\S]*?\\n```|' + delimitersRegexp; // Fenced block delimiters
	delimitersRegexp = new RegExp(delimitersRegexp, 'gm');

	var parserSectionList = [];
	var sectionCounter = 0;

	function onContentChanged(content) {
		var text = content;
		var tmpText = text + "\n\n";
		function addSection(startOffset, endOffset) {
			var sectionText = tmpText.substring(offset, endOffset);
			parserSectionList.push({
				id: ++sectionCounter,
				text: sectionText,
				textWithFrontMatter: sectionText
			});
		}
		parserSectionList = [];
		var offset = 0;
		// Look for delimiters
		tmpText.replace(delimitersRegexp, function(match, matchOffset) {
			// Create a new section with the text preceding the delimiter
			addSection(offset, matchOffset);
			offset = matchOffset;
		});
		// Last section
		addSection(offset, text.length);

		updateSectionList(parserSectionList);
		highlightSections();
	}


	// Used to detect editor changes
	function Watcher() {
		this.isWatching = false;
		var contentObserver;
		this.startWatching = function() {
			this.isWatching = true;
			contentObserver = contentObserver || new MutationObserver(checkContentChange);
			contentObserver.observe(contentElt, {
				childList: true,
				subtree: true,
				characterData: true
			});
		};
		this.stopWatching = function() {
			contentObserver.disconnect();
			this.isWatching = false;
		};
		this.noWatch = function(cb) {
			if(this.isWatching === true) {
				this.stopWatching();
				cb();
				this.startWatching();
			}
			else {
				cb();
			}
		};
	}

	var watcher = new Watcher();
	editor.watcher = watcher;

	var diffMatchPatch = new diff_match_patch();

	function SelectionMgr() {
		var self = this;
		var lastSelectionStart = 0, lastSelectionEnd = 0;
		this.selectionStart = 0;
		this.selectionEnd = 0;
		this.findOffsets = function(offsetList) {
			var result = [];
			if(!offsetList.length) {
				return result;
			}
			var offset = offsetList.shift();
			var walker = document.createTreeWalker(contentElt, 4, null, false);
			var text = '';
			var walkerOffset = 0;
			while(walker.nextNode()) {
				text = walker.currentNode.nodeValue || '';
				var newWalkerOffset = walkerOffset + text.length;
				while(newWalkerOffset > offset) {
					result.push({
						container: walker.currentNode,
						offsetInContainer: offset - walkerOffset,
						offset: offset
					});
					if(!offsetList.length) {
						return result;
					}
					offset = offsetList.shift();
				}
				walkerOffset = newWalkerOffset;
			}
			do {
				result.push({
					container: walker.currentNode,
					offsetInContainer: text.length,
					offset: offset
				});
				offset = offsetList.shift();
			}
			while(offset);
			return result;
		};
		this.createRange = function(start, end) {
			start = start < 0 ? 0 : start;
			end = end < 0 ? 0 : end;
			var range = document.createRange();
			var offsetList = [], startIndex, endIndex;
			if(typeof(start) == 'number') {
				offsetList.push(start);
				startIndex = offsetList.length - 1;
			}
			if(typeof(end) == 'number') {
				offsetList.push(end);
				endIndex = offsetList.length - 1;
			}
			offsetList = this.findOffsets(offsetList);
			var startOffset = typeof(start) == 'object' ? start : offsetList[startIndex];
			range.setStart(startOffset.container, startOffset.offsetInContainer);
			var endOffset = startOffset;
			if(end && end != start) {
				endOffset = typeof(end) == 'object' ? end : offsetList[endIndex];
			}
			range.setEnd(endOffset.container, endOffset.offsetInContainer);
			return range;
		};
		this.updateSelectionRange = function() {
			var min = Math.min(this.selectionStart, this.selectionEnd);
			var max = Math.max(this.selectionStart, this.selectionEnd);
			var range = this.createRange(min, max);
			var selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range, this.selectionStart > this.selectionEnd);
		};
		this.setSelectionStartEnd = function(start, end) {
			if(start === undefined)
				start = this.selectionStart;
			if(start < 0)
				start = 0;
			if(end === undefined)
				end = this.selectionEnd;
			if(end < 0)
				end = 0;
			this.selectionStart = start;
			this.selectionEnd = end;
		};
		this.saveSelectionState = (function() {
			function save() {
				var selectionStart = self.selectionStart;
				var selectionEnd = self.selectionEnd;
				var selection = window.getSelection();
				if(selection.rangeCount > 0) {
					var selectionRange = selection.getRangeAt(0);
					var element = selectionRange.startContainer;
					if((contentElt.compareDocumentPosition(element) & 0x10)) {
						var container = element;
						var offset = selectionRange.startOffset;
						do {
							while(element = element.previousSibling) {
								if(element.textContent) {
									offset += element.textContent.length;
								}
							}
							element = container = container.parentNode;
						} while(element && element != inputElt);

						selectionStart = offset;
						selectionEnd = offset + (selectionRange + '').length;

						if(selectionStart === selectionEnd && selectionRange.startContainer.textContent == '\n' && selectionRange.startOffset == 1) {
							// In IE if end of line is selected, offset is wrong
							// Also, in Firefox cursor can be after the trailingLfNode
							selectionStart = --selectionEnd;
							self.setSelectionStartEnd(selectionStart, selectionEnd);
							self.updateSelectionRange();
						}
					}

					self.setSelectionStartEnd(selectionStart, selectionEnd);
				}
				undoMgr.saveSelectionState();
			}

			return function() {
				save();
			};
		})();
	}

	var selectionMgr = new SelectionMgr();
	editor.selectionMgr = selectionMgr;
	$(document).on('selectionchange', '.editor-content', selectionMgr.saveSelectionState);

	function adjustCursorPosition(force) {
		if(inputElt === undefined) {
			return;
		}
		selectionMgr.saveSelectionState();
	}

	editor.adjustCursorPosition = adjustCursorPosition;

	var textContent;

	function setValue(value) {
		var startOffset = diffMatchPatch.diff_commonPrefix(textContent, value);
		if(startOffset === textContent.length)
			startOffset--;
		var endOffset = Math.min(
			diffMatchPatch.diff_commonSuffix(textContent, value),
			textContent.length - startOffset,
			value.length - startOffset
		);
		var replacement = value.substring(startOffset, value.length - endOffset);
		var range = selectionMgr.createRange(startOffset, textContent.length - endOffset);
		range.deleteContents();
		range.insertNode(document.createTextNode(replacement));
		return {
			start: startOffset,
			end: value.length - endOffset
		};
	}

	editor.setValue = setValue;

	function replace(selectionStart, selectionEnd, replacement) {
		undoMgr.currentMode = undoMgr.currentMode || 'replace';
		var range = selectionMgr.createRange(selectionStart, selectionEnd);
		if('' + range == replacement) {
			return;
		}
		range.deleteContents();
		range.insertNode(document.createTextNode(replacement));
		var endOffset = selectionStart + replacement.length;
		selectionMgr.setSelectionStartEnd(endOffset, endOffset);
		selectionMgr.updateSelectionRange();
	}

	editor.replace = replace;

	function replaceAll(search, replacement) {
		undoMgr.currentMode = undoMgr.currentMode || 'replace';
		var value = textContent.replace(search, replacement);
		if(value != textContent) {
			var offset = editor.setValue(value);
			selectionMgr.setSelectionStartEnd(offset.end, offset.end);
			selectionMgr.updateSelectionRange();
		}
	}

	editor.replaceAll = replaceAll;

	function replacePreviousText(text, replacement) {
		var offset = selectionMgr.selectionStart;
		if(offset !== selectionMgr.selectionEnd) {
			return false;
		}
		var range = selectionMgr.createRange(offset - text.length, offset);
		if('' + range != text) {
			return false;
		}
		range.deleteContents();
		range.insertNode(document.createTextNode(replacement));
		offset = offset - text.length + replacement.length;
		selectionMgr.setSelectionStartEnd(offset, offset);
		selectionMgr.updateSelectionRange();
		return true;
	}

	editor.replacePreviousText = replacePreviousText;

	function setValueNoWatch(value) {
		setValue(value);
		textContent = value;
	}

	editor.setValueNoWatch = setValueNoWatch;

	function getValue() {
		return textContent;
	}

	editor.getValue = getValue;

	function focus() {
		$contentElt.focus();
		selectionMgr.updateSelectionRange();
	}

	editor.focus = focus;

	function UndoMgr() {
		var undoStack = [];
		var redoStack = [];
		var lastTime;
		var lastMode;
		var currentState;
		var selectionStartBefore;
		var selectionEndBefore;
		this.setCommandMode = function() {
			this.currentMode = 'command';
		};
		this.setMode = function() {
		}; // For compatibility with PageDown
		this.onButtonStateChange = function() {
		}; // To be overridden by PageDown
		this.saveState = function() {
			redoStack = [];
			var currentTime = Date.now();
			if(this.currentMode == 'comment' ||
				this.currentMode == 'replace' ||
				lastMode == 'newlines' ||
				this.currentMode != lastMode ||
				currentTime - lastTime > 1000
			) {
				undoStack.push(currentState);
				// Limit the size of the stack
				while(undoStack.length > 100) {
					undoStack.shift();
				}
			}
			else {
				// Restore selectionBefore that has potentially been modified by saveSelectionState
				selectionStartBefore = currentState.selectionStartBefore;
				selectionEndBefore = currentState.selectionEndBefore;
			}
			currentState = {
				selectionStartBefore: selectionStartBefore,
				selectionEndBefore: selectionEndBefore,
				selectionStartAfter: selectionMgr.selectionStart,
				selectionEndAfter: selectionMgr.selectionEnd,
				content: textContent
			};
			lastTime = currentTime;
			lastMode = this.currentMode;
			this.currentMode = undefined;
			this.onButtonStateChange();
		};
		this.saveSelectionState = function() {
			// Should happen just after saveState
			if(this.currentMode === undefined) {
				selectionStartBefore = selectionMgr.selectionStart;
				selectionEndBefore = selectionMgr.selectionEnd;
			}
		};
		this.canUndo = function() {
			return undoStack.length;
		};
		this.canRedo = function() {
			return redoStack.length;
		};
		function restoreState(state, selectionStart, selectionEnd) {
			// Update editor
			watcher.noWatch(function() {
				if(textContent != state.content) {
					setValueNoWatch(state.content);
					onContentChanged(state.content);
				}
				selectionMgr.setSelectionStartEnd(selectionStart, selectionEnd);
				selectionMgr.updateSelectionRange();
			});

			selectionStartBefore = selectionStart;
			selectionEndBefore = selectionEnd;
			currentState = state;
			this.currentMode = undefined;
			lastMode = undefined;
			this.onButtonStateChange();
			adjustCursorPosition();
		}

		this.undo = function() {
			var state = undoStack.pop();
			if(!state) {
				return;
			}
			redoStack.push(currentState);
			restoreState.call(this, state, currentState.selectionStartBefore, currentState.selectionEndBefore);
		};
		this.redo = function() {
			var state = redoStack.pop();
			if(!state) {
				return;
			}
			undoStack.push(currentState);
			restoreState.call(this, state, state.selectionStartAfter, state.selectionEndAfter);
		};
		this.init = function() {
			var content = defaultContent;
			undoStack = [];
			redoStack = [];
			lastTime = 0;
			currentState = {
				selectionStartAfter: 0,
				selectionEndAfter: 0,
				content: content
			};
			this.currentMode = undefined;
			lastMode = undefined;
			contentElt.textContent = content;
			// Force this since the content could be the same
			checkContentChange();
		};
	}

	var undoMgr = new UndoMgr();
	editor.undoMgr = undoMgr;

	function checkContentChange() {
		var newTextContent = inputElt.textContent;
		if(contentElt.lastChild === trailingLfNode && trailingLfNode.textContent.slice(-1) == '\n') {
			newTextContent = newTextContent.slice(0, -1);
		}
		newTextContent = newTextContent.replace(/\r\n?/g, '\n'); // Mac/DOS to Unix

		if(newTextContent == textContent) {
			// User has removed the empty section
			if(contentElt.children.length === 0) {
				contentElt.innerHTML = '';
				sectionList.forEach(function(section) {
					contentElt.appendChild(section.elt);
				});
				addTrailingLfNode();
			}
			return;
		}
		undoMgr.currentMode = undoMgr.currentMode || 'typing';
		textContent = newTextContent;
		selectionMgr.saveSelectionState();
		onContentChanged(textContent);
		undoMgr.saveState();
	}

	editor.init = function() {
		inputElt = document.getElementById('wmd-input');
		$inputElt = $(inputElt);
		contentElt = inputElt.querySelector('.editor-content');
		$contentElt = $(contentElt);

		watcher.startWatching();

		// See https://gist.github.com/shimondoodkin/1081133
		if(/AppleWebKit\/([\d.]+)/.exec(navigator.userAgent)) {
			var $editableFix = $('<input style="width:1px;height:1px;border:none;margin:0;padding:0;" tabIndex="-1">').appendTo('html');
			$contentElt.blur(function() {
				$editableFix[0].setSelectionRange(0, 0);
				$editableFix.blur();
			});
		}

		inputElt.focus = focus;
		inputElt.adjustCursorPosition = adjustCursorPosition;

		Object.defineProperty(inputElt, 'value', {
			get: function() {
				return textContent;
			},
			set: setValue
		});

		Object.defineProperty(inputElt, 'selectionStart', {
			get: function() {
				return Math.min(selectionMgr.selectionStart, selectionMgr.selectionEnd);
			},
			set: function(value) {
				selectionMgr.setSelectionStartEnd(value);
				selectionMgr.updateSelectionRange();
			},

			enumerable: true,
			configurable: true
		});

		Object.defineProperty(inputElt, 'selectionEnd', {
			get: function() {
				return Math.max(selectionMgr.selectionStart, selectionMgr.selectionEnd);
			},
			set: function(value) {
				selectionMgr.setSelectionStartEnd(undefined, value);
				selectionMgr.updateSelectionRange();
			},

			enumerable: true,
			configurable: true
		});

		var clearNewline = false;
		$contentElt
			.on('keydown', function(evt) {
				if(
					evt.which === 17 || // Ctrl
					evt.which === 91 || // Cmd
					evt.which === 18 || // Alt
					evt.which === 16 // Shift
				) {
					return;
				}
				selectionMgr.saveSelectionState();
				adjustCursorPosition();

				var cmdOrCtrl = evt.metaKey || evt.ctrlKey;

				switch(evt.which) {
					case 9: // Tab
						if(!cmdOrCtrl) {
							action('indent', {
								inverse: evt.shiftKey
							});
							evt.preventDefault();
						}
						break;
					case 13:
						action('newline');
						evt.preventDefault();
						break;
				}
				if(evt.which !== 13) {
					clearNewline = false;
				}
			})
			.on('mouseup', selectionMgr.saveSelectionState)
			.on('paste', function(evt) {
				undoMgr.currentMode = 'paste';
				evt.preventDefault();
				var data = (evt.originalEvent || evt).clipboardData.getData('text/plain') || prompt('Paste something...');
				data = escape(data);
				adjustCursorPosition();
				document.execCommand('insertHtml', false, data);
			})
			.on('cut', function() {
				undoMgr.currentMode = 'cut';
				adjustCursorPosition();
			})
			.on('focus', function() {
				selectionMgr.hasFocus = true;
			})
			.on('blur', function() {
				selectionMgr.hasFocus = false;
			});

		var action = function(action, options) {
			var textContent = getValue();
			var min = Math.min(selectionMgr.selectionStart, selectionMgr.selectionEnd);
			var max = Math.max(selectionMgr.selectionStart, selectionMgr.selectionEnd);
			var state = {
				selectionStart: min,
				selectionEnd: max,
				before: textContent.slice(0, min),
				after: textContent.slice(max),
				selection: textContent.slice(min, max)
			};

			actions[action](state, options || {});
			setValue(state.before + state.selection + state.after);
			selectionMgr.setSelectionStartEnd(state.selectionStart, state.selectionEnd);
			selectionMgr.updateSelectionRange();
		};

		var indentRegex = /^ {0,3}>[ ]*|^[ \t]*(?:[*+\-]|(\d+)\.)[ \t]|^\s+/;
		var actions = {
			indent: function(state, options) {
				function strSplice(str, i, remove, add) {
					remove = +remove || 0;
					add = add || '';
					return str.slice(0, i) + add + str.slice(i + remove);
				}

				var lf = state.before.lastIndexOf('\n') + 1;
				if(options.inverse) {
					if(/\s/.test(state.before.charAt(lf))) {
						state.before = strSplice(state.before, lf, 1);

						state.selectionStart--;
						state.selectionEnd--;
					}
					state.selection = state.selection.replace(/^[ \t]/gm, '');
				} else {
					var previousLine = state.before.slice(lf);
					if(state.selection || previousLine.match(indentRegex)) {
						state.before = strSplice(state.before, lf, 0, '\t');
						state.selection = state.selection.replace(/\r?\n(?=[\s\S])/g, '\n\t');
						state.selectionStart++;
						state.selectionEnd++;
					} else {
						state.before += '\t';
						state.selectionStart++;
						state.selectionEnd++;
						return;
					}
				}

				state.selectionEnd = state.selectionStart + state.selection.length;
			},

			newline: function(state) {
				var lf = state.before.lastIndexOf('\n') + 1;
				if(clearNewline) {
					state.before = state.before.substring(0, lf);
					state.selection = '';
					state.selectionStart = lf;
					state.selectionEnd = lf;
					clearNewline = false;
					return;
				}
				clearNewline = false;
				var previousLine = state.before.slice(lf);
				var indentMatch = previousLine.match(indentRegex);
				var indent = (indentMatch || [''])[0];
				if(indentMatch && indentMatch[1]) {
					var number = parseInt(indentMatch[1], 10);
					indent = indent.replace(/\d+/, number + 1);
				}
				if(indent.length) {
					clearNewline = true;
				}

				undoMgr.currentMode = 'newlines';

				state.before += '\n' + indent;
				state.selection = '';
				state.selectionStart += indent.length + 1;
				state.selectionEnd = state.selectionStart;
			}
		};
	};

	var sectionList = [];
	var sectionsToRemove = [];
	var modifiedSections = [];
	var insertBeforeSection;

	function updateSectionList(newSectionList) {

		modifiedSections = [];
		sectionsToRemove = [];
		insertBeforeSection = undefined;

		// Find modified section starting from top
		var leftIndex = sectionList.length;
		$.each(sectionList, function(index, section) {
			var newSection = newSectionList[index];
			if(index >= newSectionList.length ||
					// Check modified
				section.textWithFrontMatter != newSection.textWithFrontMatter ||
					// Check that section has not been detached or moved
				section.elt.parentNode !== contentElt ||
					// Check also the content since nodes can be injected in sections via copy/paste
				section.elt.textContent != newSection.textWithFrontMatter) {
				leftIndex = index;
				return false;
			}
		});

		// Find modified section starting from bottom
		var rightIndex = -sectionList.length;
		$.each(sectionList.slice().reverse(), function(index, section) {
			var newSection = newSectionList[newSectionList.length - index - 1];
			if(index >= newSectionList.length ||
					// Check modified
				section.textWithFrontMatter != newSection.textWithFrontMatter ||
					// Check that section has not been detached or moved
				section.elt.parentNode !== contentElt ||
					// Check also the content since nodes can be injected in sections via copy/paste
				section.elt.textContent != newSection.textWithFrontMatter) {
				rightIndex = -index;
				return false;
			}
		});

		if(leftIndex - rightIndex > sectionList.length) {
			// Prevent overlap
			rightIndex = leftIndex - sectionList.length;
		}

		// Create an array composed of left unmodified, modified, right unmodified sections
		var leftSections = sectionList.slice(0, leftIndex);
		modifiedSections = newSectionList.slice(leftIndex, newSectionList.length + rightIndex);
		var rightSections = sectionList.slice(sectionList.length + rightIndex, sectionList.length);
		insertBeforeSection = rightSections[0];
		sectionsToRemove = sectionList.slice(leftIndex, sectionList.length + rightIndex);
		sectionList = leftSections.concat(modifiedSections).concat(rightSections);
	}

	function highlightSections() {
		var newSectionEltList = document.createDocumentFragment();
		modifiedSections.forEach(function(section) {
			highlight(section);
			newSectionEltList.appendChild(section.elt);
		});
		watcher.noWatch(function() {

			// Remove outdated sections
			sectionsToRemove.forEach(function(section) {
				// section can be already removed
				section.elt.parentNode === contentElt && contentElt.removeChild(section.elt);
			});

			if(insertBeforeSection !== undefined) {
				contentElt.insertBefore(newSectionEltList, insertBeforeSection.elt);
			}
			else {
				contentElt.appendChild(newSectionEltList);
			}

			// Remove unauthorized nodes (text nodes outside of sections or duplicated sections via copy/paste)
			var childNode = contentElt.firstChild;
			while(childNode) {
				var nextNode = childNode.nextSibling;
				if(!childNode.generated) {
					contentElt.removeChild(childNode);
				}
				childNode = nextNode;
			}

			addTrailingLfNode();
			selectionMgr.updateSelectionRange();
		});
	}

	function addTrailingLfNode() {
		trailingLfNode = $('<span class="token lf">\n</span>')[0];
		contentElt.appendChild(trailingLfNode);
	}

	var escape = (function() {
		var entityMap = {
			"&": "&amp;",
			"<": "&lt;",
			"\u00a0": ' '
		};
		return function(str) {
			return str.replace(/[&<\u00a0]/g, function(s) {
				return entityMap[s];
			});
		};
	})();

	function highlight(section) {
		var text = escape(section.text);
		text = Prism.highlight(text, Prism.languages.md);

		var sectionElt = $('<span id="wmd-input-section-'+ section.id +'" class="wmd-input-section">'+ text +'</span>')[0];
		sectionElt.generated = true;
		section.elt = sectionElt;
	}


// core.js

	var core = {};

	// Shortcuts mapping
	function bindPagedownButton(buttonName) {
		return function(evt) {
			pagedownEditor.uiManager.doClick(pagedownEditor.uiManager.buttons[buttonName]);
			evt.preventDefault();
		};
	}
	shortcutsMapping = {
		'mod+b': bindPagedownButton('bold'),
		'mod+i': bindPagedownButton('italic'),
		'mod+l': bindPagedownButton('link'),
		'mod+q': bindPagedownButton('quote'),
		'mod+k': bindPagedownButton('code'),
		'mod+g': bindPagedownButton('image'),
		'mod+o': bindPagedownButton('olist'),
		'mod+u': bindPagedownButton('ulist'),
		'mod+h': bindPagedownButton('heading'),
		'mod+r': bindPagedownButton('hr'),
		'mod+z': bindPagedownButton('undo'),
		'mod+y': bindPagedownButton('redo'),
		'mod+shift+z': bindPagedownButton('redo')
	};

	// Modal state
	var isModalShown = false;
	$(document.body).on('show.bs.modal', '.modal', function() {
		isModalShown = true;
	}).on('hidden.bs.modal', '.modal', function() {
		isModalShown = false;
	});

	// Configure Mousetrap
	Mousetrap.stopCallback = function() {
		return isModalShown;
	};

	// Create the PageDown editor
	var pagedownEditor;
	core.initEditor = function() {
		if(pagedownEditor !== undefined) {
			// If the editor is already created
			editor.undoMgr.init();
			return pagedownEditor.uiManager.setUndoRedoButtonStates();
		}

		// Create the converter and the editor
		pagedownEditor = new Markdown.Editor(undefined, {
			undoManager: editor.undoMgr
		});

		// Custom insert link dialog
		pagedownEditor.hooks.set("insertLinkDialog", function(callback) {
			core.insertLinkCallback = callback;
			$(".modal input[type=text]").val("");
			$(".modal-insert-link").modal();
			return true;
		});
		// Custom insert image dialog
		pagedownEditor.hooks.set("insertImageDialog", function(callback) {
			core.insertLinkCallback = callback;
			$(".modal input[type=text]").val("");
			$(".modal-insert-image").modal();
			return true;
		});


		pagedownEditor.run();
		editor.undoMgr.init();

		// Set shortcuts
		$.each(shortcutsMapping, function(shortcut, func) {
			Mousetrap.bind(shortcut, func);
		});

		// Hide default buttons
		$(".wmd-button-row li").addClass("btn btn-default");

		// Add customized buttons
		$("#wmd-bold-button").append($('<span class="glyphicon glyphicon-bold">')).appendTo($('.wmd-buttons .btn-group1'));
		$("#wmd-italic-button").append($('<span class="glyphicon glyphicon-italic">')).appendTo($('.wmd-buttons .btn-group1'));

		$("#wmd-heading-button").append($('<span class="glyphicon glyphicon-text-height">')).appendTo($('.wmd-buttons .btn-group2'));
		$("#wmd-quote-button").append($('<span class="glyphicon glyphicon-indent-right">')).appendTo($('.wmd-buttons .btn-group2'));
		$("#wmd-code-button").append($('<span class="glyphicon glyphicon-flash">')).appendTo($('.wmd-buttons .btn-group2'));

		$("#wmd-ulist-button").append($('<span class="glyphicon glyphicon-align-justify">')).appendTo($('.wmd-buttons .btn-group3'));
		$("#wmd-olist-button").append($('<span class="glyphicon glyphicon-list">')).appendTo($('.wmd-buttons .btn-group3'));

		$("#wmd-link-button").append($('<span class="glyphicon glyphicon-link">')).appendTo($('.wmd-buttons .btn-group4'));
		$("#wmd-image-button").append($('<span class="glyphicon glyphicon-picture">')).appendTo($('.wmd-buttons .btn-group4'));
		$("#wmd-hr-button").append($('<span class="glyphicon glyphicon-minus">')).appendTo($('.wmd-buttons .btn-group4'));

		$("#wmd-undo-button").append($('<span class="glyphicon glyphicon-arrow-right">')).appendTo($('.wmd-buttons .btn-group5'));
		$("#wmd-redo-button").append($('<span class="glyphicon glyphicon-arrow-left">')).appendTo($('.wmd-buttons .btn-group5'));

		// Other initialization that are not prioritary
		$(document.body).on('shown.bs.modal', '.modal', function() {
			var $elt = $(this);
			setTimeout(function() {
				// When modal opens focus on the first button
				$elt.find('.btn:first').focus();
				// Or on the first link if any
				$elt.find('button:first').focus();
				// Or on the first input if any
				$elt.find("input:enabled:visible:first").focus();
			}, 50);
		}).on('hidden.bs.modal', '.modal', function() {
			// Focus on the editor when modal is gone
			editor.focus();
		}).on('keyup', '.modal', function(e) {
			// Handle enter key in modals
			if(e.which == 13 && !$(e.target).is("textarea")) {
				$(this).find(".modal-footer a:last").click();
			}
		});

		// Click events on "insert link" and "insert image" dialog buttons
		$(".action-insert-link").click(function(e) {
			var value = $("#input-insert-link").val();
			if(value !== undefined) {
				core.insertLinkCallback(value);
				core.insertLinkCallback = undefined;
			}
		});
		$(".action-insert-image").click(function(e) {
			var value = $("#input-insert-image").val();
			if(value !== undefined) {
				core.insertLinkCallback(value);
				core.insertLinkCallback = undefined;
			}
		});

		// Hide events on "insert link" and "insert image" dialogs
		$(".modal-insert-link, .modal-insert-image").on('hidden.bs.modal', function() {
			if(core.insertLinkCallback !== undefined) {
				core.insertLinkCallback(null);
				core.insertLinkCallback = undefined;
			}
		});
	};


// main.js
	text = this.text();

	this.html(
		'<div class="wmd-buttons"><ul class="btn-group btn-group1"></ul><ul class="btn-group btn-group2"></ul><ul class="btn-group btn-group3"></ul><ul class="btn-group btn-group4"></ul><ul class="btn-group btn-group5"></ul></div><div id="wmd-button-bar" class="hide"></div>'+
		'<pre id="wmd-input"><div class="editor-content" contenteditable=true></div></pre>'
	);
	$(document.body).append(
		'<div class="modal fade modal-insert-link"><div class="modal-dialog"><div class="modal-content">'+
		'<div class="modal-body"><p>آدرس پیوند را اینجا بنویسید:</p><div class="input-group"><span class="input-group-addon"><span class="glyphicon glyphicon-globe"></span></span><input id="input-insert-link" type="text" class="col-sm-5 form-control" placeholder="http://example.com/" /></div></div>'+
		'<div class="modal-footer"><a href="#" class="btn btn-primary action-insert-link"data-dismiss="modal">تایید</a> <a href="#" class="btn btn-default" data-dismiss="modal">لغو</a></div>'+
		'</div></div></div>'
	);
	$(document.body).append(
		'<div class="modal fade modal-insert-image"><div class="modal-dialog"><div class="modal-content">'+
		'<div class="modal-body"><p>آدرس تصویر را اینجا بنویسید:</p><div class="input-group"><span class="input-group-addon"><i class="glyphicon glyphicon-picture"></i></span><input id="input-insert-image" type="text" class="col-sm-5 form-control" placeholder="http://example.com/image.jpg" /></div></div>'+
		'<div class="modal-footer"><a href="#" class="btn btn-primary action-insert-image" data-dismiss="modal">تایید</a> <a href="#" class="btn btn-default" data-dismiss="modal">لغو</a></div>'+
		'</div></div></div>'
	);

	editor.init();
	core.initEditor();

	editor.setValue(text)
	return editor;
};
