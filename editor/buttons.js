var Markdown = {};

(function () {

	function identity(x) { return x; }
	function returnFalse(x) { return false; }

	function HookCollection() { }

	HookCollection.prototype = {

		chain: function (hookname, func) {
			var original = this[hookname];
			if (!original)
				throw new Error("unknown hook " + hookname);

			if (original === identity)
				this[hookname] = func;
			else
				this[hookname] = function (text) {
					var args = Array.prototype.slice.call(arguments, 0);
					args[0] = original.apply(null, args);
					return func.apply(null, args);
				};
		},
		set: function (hookname, func) {
			if (!this[hookname])
				throw new Error("unknown hook " + hookname);
			this[hookname] = func;
		},
		addNoop: function (hookname) {
			this[hookname] = identity;
		},
		addFalse: function (hookname) {
			this[hookname] = returnFalse;
		}
	};

	Markdown.HookCollection = HookCollection;
})();

(function () {

	var util = {},
		position = {},
		ui = {},
		doc = window.document,
		re = window.RegExp,
		nav = window.navigator,

	// Used to work around some browser bugs where we can't use feature testing.
		uaSniffed = {
			isIE: /msie/.test(nav.userAgent.toLowerCase()),
			isIE_5or6: /msie 6/.test(nav.userAgent.toLowerCase()) || /msie 5/.test(nav.userAgent.toLowerCase()),
			isOpera: /opera/.test(nav.userAgent.toLowerCase())
		};

	var defaultsStrings = {
		bold: 'درشت',
		boldexample: 'درشت',

		italic: 'مورب',
		italicexample: 'مورب',

		link: 'پیوند',
		linkdescription: 'پیوند',
		linkdialog: '',

		quote: 'نقل قول',
		quoteexample: 'نقل قول',

		code: 'کد',
		codeexample: '...',

		image: 'تصویر',
		imagedescription: 'توضیح تصویر',
		imagedialog: '',

		ulist: 'فهرست بی‌شماره',
		olist: 'فهرست شماره‌دار',
		litem: 'مورد',

		heading: 'عنوان',
		headingexample: 'عنوان',

		hr: 'خط افقی',

		undo: 'بازگشت',
		redo: 'انجام مجدد',

		pdf: 'نسخه قابل چاپ',
		help: 'راهنمای مرتب‌نویسی',

		revert: 'بازیابی آخرین نوشته'
	};

	// The default text that appears in the dialog input box when entering links.
	var imageDefaultText = 'http://';
	var linkDefaultText = 'http://';

	// The constructed editor object has the methods:
	// - run() actually starts the editor; should be called after all necessary plugins are registered. Calling this more than once is a no-op.
	Markdown.Editor = function (idPostfix, options) {
		options = options || {};

		options.strings = options.strings || {};
		var getString = function (identifier) { return identifier in options.strings ? options.strings[identifier] : defaultsStrings[identifier]; }

		idPostfix = idPostfix || "";

		var hooks = this.hooks = new Markdown.HookCollection();
		hooks.addNoop("postBlockquoteCreation"); // called with the user's selection *after* the blockquote was created; should return the actual to-be-inserted text
		hooks.addFalse("insertImageDialog");     /* called with one parameter: a callback to be called with the URL of the image. If the application creates
												  * its own image insertion dialog, this hook should return true, and the callback should be called with the chosen
												  * image url (or null if the user cancelled). If this hook returns false, the default dialog will be used.
												  */
		hooks.addFalse("insertLinkDialog");

		var that = this,
			panels;

		var undoManager;
		this.run = function () {
			if (panels)
				return; // already initialized

			panels = new PanelCollection(idPostfix);
			var commandManager = new CommandManager(hooks, getString);
			var uiManager;

			if(options.undoManager) {
				undoManager = options.undoManager;
				undoManager.onButtonStateChange = function() {
					uiManager.setUndoRedoButtonStates();
				};
				if (uiManager) // not available on the first call
					uiManager.setUndoRedoButtonStates();
			}
			else if (!/\?noundo/.test(doc.location.href)) {
				undoManager = new UndoManager(function () {
					if (uiManager) // not available on the first call
						uiManager.setUndoRedoButtonStates();
				}, panels);
				this.textOperation = function (f) {
					undoManager.setCommandMode();
					f();
				}
			}

			uiManager = new UIManager(idPostfix, panels, undoManager, commandManager, getString);
			uiManager.setUndoRedoButtonStates();

			that.undoManager = undoManager;
			that.uiManager = uiManager;
		};

	}

	// before: contains all the text in the input box BEFORE the selection.
	// after: contains all the text in the input box AFTER the selection.
	function Chunks() { }

	// startRegex: a regular expression to find the start tag
	// endRegex: a regular expresssion to find the end tag
	Chunks.prototype.findTags = function (startRegex, endRegex) {

		var chunkObj = this;
		var regex;

		if (startRegex) {

			regex = util.extendRegExp(startRegex, "", "$");

			this.before = this.before.replace(regex,
				function (match) {
					chunkObj.startTag = chunkObj.startTag + match;
					return "";
				});

			regex = util.extendRegExp(startRegex, "^", "");

			this.selection = this.selection.replace(regex,
				function (match) {
					chunkObj.startTag = chunkObj.startTag + match;
					return "";
				});
		}

		if (endRegex) {

			regex = util.extendRegExp(endRegex, "", "$");

			this.selection = this.selection.replace(regex,
				function (match) {
					chunkObj.endTag = match + chunkObj.endTag;
					return "";
				});

			regex = util.extendRegExp(endRegex, "^", "");

			this.after = this.after.replace(regex,
				function (match) {
					chunkObj.endTag = match + chunkObj.endTag;
					return "";
				});
		}
	};

	// If remove is false, the whitespace is transferred
	// to the before/after regions.
	//
	// If remove is true, the whitespace disappears.
	Chunks.prototype.trimWhitespace = function (remove) {
		var beforeReplacer, afterReplacer, that = this;
		if (remove) {
			beforeReplacer = afterReplacer = "";
		} else {
			beforeReplacer = function (s) { that.before += s; return ""; }
			afterReplacer = function (s) { that.after = s + that.after; return ""; }
		}

		this.selection = this.selection.replace(/^(\s*)/, beforeReplacer).replace(/(\s*)$/, afterReplacer);
	};


	Chunks.prototype.skipLines = function (nLinesBefore, nLinesAfter, findExtraNewlines) {

		if (nLinesBefore === undefined) {
			nLinesBefore = 1;
		}

		if (nLinesAfter === undefined) {
			nLinesAfter = 1;
		}

		nLinesBefore++;
		nLinesAfter++;

		var regexText;
		var replacementText;

		// chrome bug ... documented at: http://meta.stackoverflow.com/questions/63307/blockquote-glitch-in-editor-in-chrome-6-and-7/65985#65985
		if (navigator.userAgent.match(/Chrome/)) {
			"X".match(/()./);
		}

		this.selection = this.selection.replace(/(^\n*)/, "");

		this.startTag = this.startTag + re.$1;

		this.selection = this.selection.replace(/(\n*$)/, "");
		this.endTag = this.endTag + re.$1;
		this.startTag = this.startTag.replace(/(^\n*)/, "");
		this.before = this.before + re.$1;
		this.endTag = this.endTag.replace(/(\n*$)/, "");
		this.after = this.after + re.$1;

		if (this.before) {

			regexText = replacementText = "";

			while (nLinesBefore--) {
				regexText += "\\n?";
				replacementText += "\n";
			}

			if (findExtraNewlines) {
				regexText = "\\n*";
			}
			this.before = this.before.replace(new re(regexText + "$", ""), replacementText);
		}

		if (this.after) {

			regexText = replacementText = "";

			while (nLinesAfter--) {
				regexText += "\\n?";
				replacementText += "\n";
			}
			if (findExtraNewlines) {
				regexText = "\\n*";
			}

			this.after = this.after.replace(new re(regexText, ""), replacementText);
		}
	};

	// end of Chunks

	// A collection of the important regions on the page.
	// Cached so we don't have to keep traversing the DOM.
	// Also holds ieCachedRange and ieCachedScrollTop, where necessary; working around
	// this issue:
	// Internet explorer has problems with CSS sprite buttons that use HTML
	// lists.  When you click on the background image "button", IE will
	// select the non-existent link text and discard the selection in the
	// textarea.  The solution to this is to cache the textarea selection
	// on the button's mousedown event and set a flag.  In the part of the
	// code where we need to grab the selection, we check for the flag
	// and, if it's set, use the cached area instead of querying the
	// textarea.
	//
	// This ONLY affects Internet Explorer (tested on versions 6, 7
	// and 8) and ONLY on button clicks.  Keyboard shortcuts work
	// normally since the focus never leaves the textarea.
	function PanelCollection(postfix) {
		this.buttonBar = doc.getElementById("wmd-button-bar" + postfix);
		this.input = doc.getElementById("wmd-input" + postfix);
	};

	// Returns true if the DOM element is visible, false if it's hidden.
	// Checks if display is anything other than none.
	util.isVisible = function (elem) {

		if (window.getComputedStyle) {
			// Most browsers
			return window.getComputedStyle(elem, null).getPropertyValue("display") !== "none";
		}
		else if (elem.currentStyle) {
			// IE
			return elem.currentStyle["display"] !== "none";
		}
	};


	// Adds a listener callback to a DOM element which is fired on a specified
	// event.
	util.addEvent = function (elem, event, listener) {
		if (elem.attachEvent) {
			// IE only.  The "on" is mandatory.
			elem.attachEvent("on" + event, listener);
		}
		else {
			// Other browsers.
			elem.addEventListener(event, listener, false);
		}
	};


	// Removes a listener callback from a DOM element which is fired on a specified
	// event.
	util.removeEvent = function (elem, event, listener) {
		if (elem.detachEvent) {
			// IE only.  The "on" is mandatory.
			elem.detachEvent("on" + event, listener);
		}
		else {
			// Other browsers.
			elem.removeEventListener(event, listener, false);
		}
	};

	// Converts \r\n and \r to \n.
	util.fixEolChars = function (text) {
		text = text.replace(/\r\n/g, "\n");
		text = text.replace(/\r/g, "\n");
		return text;
	};

	// Extends a regular expression.  Returns a new RegExp
	// using pre + regex + post as the expression.
	// Used in a few functions where we have a base
	// expression and we want to pre- or append some
	// conditions to it (e.g. adding "$" to the end).
	// The flags are unchanged.
	//
	// regex is a RegExp, pre and post are strings.
	util.extendRegExp = function (regex, pre, post) {

		if (pre === null || pre === undefined) {
			pre = "";
		}
		if (post === null || post === undefined) {
			post = "";
		}

		var pattern = regex.toString();
		var flags;

		// Replace the flags with empty space and store them.
		pattern = pattern.replace(/\/([gim]*)$/, function (wholeMatch, flagsPart) {
			flags = flagsPart;
			return "";
		});

		// Remove the slash delimiters on the regular expression.
		pattern = pattern.replace(/(^\/|\/$)/g, "");
		pattern = pre + pattern + post;

		return new re(pattern, flags);
	}

	// UNFINISHED
	// The assignment in the while loop makes jslint cranky.
	// I'll change it to a better loop later.
	position.getTop = function (elem, isInner) {
		var result = elem.offsetTop;
		if (!isInner) {
			while (elem = elem.offsetParent) {
				result += elem.offsetTop;
			}
		}
		return result;
	};

	position.getHeight = function (elem) {
		return elem.offsetHeight || elem.scrollHeight;
	};

	position.getWidth = function (elem) {
		return elem.offsetWidth || elem.scrollWidth;
	};

	position.getPageSize = function () {

		var scrollWidth, scrollHeight;
		var innerWidth, innerHeight;

		// It's not very clear which blocks work with which browsers.
		if (self.innerHeight && self.scrollMaxY) {
			scrollWidth = doc.body.scrollWidth;
			scrollHeight = self.innerHeight + self.scrollMaxY;
		}
		else if (doc.body.scrollHeight > doc.body.offsetHeight) {
			scrollWidth = doc.body.scrollWidth;
			scrollHeight = doc.body.scrollHeight;
		}
		else {
			scrollWidth = doc.body.offsetWidth;
			scrollHeight = doc.body.offsetHeight;
		}

		if (self.innerHeight) {
			// Non-IE browser
			innerWidth = self.innerWidth;
			innerHeight = self.innerHeight;
		}
		else if (doc.documentElement && doc.documentElement.clientHeight) {
			// Some versions of IE (IE 6 w/ a DOCTYPE declaration)
			innerWidth = doc.documentElement.clientWidth;
			innerHeight = doc.documentElement.clientHeight;
		}
		else if (doc.body) {
			// Other versions of IE
			innerWidth = doc.body.clientWidth;
			innerHeight = doc.body.clientHeight;
		}

		var maxWidth = Math.max(scrollWidth, innerWidth);
		var maxHeight = Math.max(scrollHeight, innerHeight);
		return [maxWidth, maxHeight, innerWidth, innerHeight];
	};

	// The input textarea state/contents.
	// This is used to implement undo/redo by the undo manager.
	function TextareaState(panels, isInitialState) {

		// Aliases
		var stateObj = this;
		var inputArea = panels.input;
		this.init = function () {
			if (!util.isVisible(inputArea)) {
				return;
			}

			this.setInputAreaSelectionStartEnd();
			this.scrollTop = inputArea.scrollTop;
			if (!this.text && inputArea.selectionStart || inputArea.selectionStart === 0) {
				this.text = inputArea.value;
			}

		}

		// Sets the selected text in the input box after we've performed an
		// operation.
		this.setInputAreaSelection = function () {

			if (!util.isVisible(inputArea))
				return;

			inputArea.selectionStart = stateObj.start;
			inputArea.selectionEnd = stateObj.end;
		};

		this.setInputAreaSelectionStartEnd = function () {

			//if (!panels.ieCachedRange && (inputArea.selectionStart || inputArea.selectionStart === 0)) {

				stateObj.start = inputArea.selectionStart;
				stateObj.end = inputArea.selectionEnd;
				/*
			}
			else if (doc.selection) {

				stateObj.text = util.fixEolChars(inputArea.value);

				// IE loses the selection in the textarea when buttons are
				// clicked.  On IE we cache the selection. Here, if something is cached,
				// we take it.
				var range = panels.ieCachedRange || doc.selection.createRange();

				var fixedRange = util.fixEolChars(range.text);
				var marker = "\x07";
				var markedRange = marker + fixedRange + marker;
				range.text = markedRange;
				var inputText = util.fixEolChars(inputArea.value);

				range.moveStart("character", -markedRange.length);
				range.text = fixedRange;

				stateObj.start = inputText.indexOf(marker);
				stateObj.end = inputText.lastIndexOf(marker) - marker.length;

				var len = stateObj.text.length - util.fixEolChars(inputArea.value).length;

				if (len) {
					range.moveStart("character", -fixedRange.length);
					while (len--) {
						fixedRange += "\n";
						stateObj.end += 1;
					}
					range.text = fixedRange;
				}

				if (panels.ieCachedRange)
					stateObj.scrollTop = panels.ieCachedScrollTop; // this is set alongside with ieCachedRange

				panels.ieCachedRange = null;

				this.setInputAreaSelection();
			}
			*/
		};

		// Restore this state into the input area.
		this.restore = function () {

			if (stateObj.text != undefined && stateObj.text != inputArea.value) {
				inputArea.value = stateObj.text;
			}
			this.setInputAreaSelection();
			/*
			setTimeout(function() {
				inputArea.scrollTop = stateObj.scrollTop;
			}, 0);
			*/
		};

		// Gets a collection of HTML chunks from the inptut textarea.
		this.getChunks = function () {

			var chunk = new Chunks();
			chunk.before = util.fixEolChars(stateObj.text.substring(0, stateObj.start));
			chunk.startTag = "";
			chunk.selection = util.fixEolChars(stateObj.text.substring(stateObj.start, stateObj.end));
			chunk.endTag = "";
			chunk.after = util.fixEolChars(stateObj.text.substring(stateObj.end));
			chunk.scrollTop = stateObj.scrollTop;

			return chunk;
		};

		// Sets the TextareaState properties given a chunk of markdown.
		this.setChunks = function (chunk) {

			chunk.before = chunk.before + chunk.startTag;
			chunk.after = chunk.endTag + chunk.after;

			this.start = chunk.before.length;
			this.end = chunk.before.length + chunk.selection.length;
			this.text = chunk.before + chunk.selection + chunk.after;
			this.scrollTop = chunk.scrollTop;
		};
		this.init();
	};

	// Creates the background behind the hyperlink text entry box.
	// And download dialog
	// Most of this has been moved to CSS but the div creation and
	// browser-specific hacks remain here.
	ui.createBackground = function () {

		var background = doc.createElement("div"),
			style = background.style;

		background.className = "wmd-prompt-background";

		style.position = "absolute";
		style.top = "0";

		style.zIndex = "1000";

		if (uaSniffed.isIE) {
			style.filter = "alpha(opacity=50)";
		}
		else {
			style.opacity = "0.5";
		}

		var pageSize = position.getPageSize();
		style.height = pageSize[1] + "px";

		if (uaSniffed.isIE) {
			style.left = doc.documentElement.scrollLeft;
			style.width = doc.documentElement.clientWidth;
		}
		else {
			style.left = "0";
			style.width = "100%";
		}

		doc.body.appendChild(background);
		return background;
	};

	// This simulates a modal dialog box and asks for the URL when you
	// click the hyperlink or image buttons.
	//
	// text: The html for the input box.
	// defaultInputText: The default value that appears in the input box.
	// callback: The function which is executed when the prompt is dismissed, either via OK or Cancel.
	//      It receives a single argument; either the entered text (if OK was chosen) or null (if Cancel
	//      was chosen).
	ui.prompt = function (text, defaultInputText, callback) {

		// These variables need to be declared at this level since they are used
		// in multiple functions.
		var dialog;         // The dialog box.
		var input;         // The text box where you enter the hyperlink.


		if (defaultInputText === undefined) {
			defaultInputText = "";
		}

		// Used as a keydown event handler. Esc dismisses the prompt.
		// Key code 27 is ESC.
		var checkEscape = function (key) {
			var code = (key.charCode || key.keyCode);
			if (code === 27) {
				close(true);
			}
		};

		// Dismisses the hyperlink input box.
		// isCancel is true if we don't care about the input text.
		// isCancel is false if we are going to keep the text.
		var close = function (isCancel) {
			util.removeEvent(doc.body, "keydown", checkEscape);
			var text = input.value;

			if (isCancel) {
				text = null;
			}
			else {
				// Fixes common pasting errors.
				text = text.replace(/^http:\/\/(https?|ftp):\/\//, '$1://');
				if (!/^(?:https?|ftp):\/\//.test(text))
					text = 'http://' + text;
			}

			dialog.parentNode.removeChild(dialog);

			callback(text);
			return false;
		};



		// Create the text input box form/window.
		var createDialog = function () {

			// The main dialog box.
			dialog = doc.createElement("div");
			dialog.className = "wmd-prompt-dialog";
			dialog.style.padding = "10px;";
			dialog.style.position = "fixed";
			dialog.style.width = "400px";
			dialog.style.zIndex = "1001";

			// The dialog text.
			var question = doc.createElement("div");
			question.innerHTML = text;
			question.style.padding = "5px";
			dialog.appendChild(question);

			// The web form container for the text box and buttons.
			var form = doc.createElement("form"),
				style = form.style;
			form.onsubmit = function () { return close(false); };
			style.padding = "0";
			style.margin = "0";
			style.cssFloat = "left";
			style.width = "100%";
			style.textAlign = "center";
			style.position = "relative";
			dialog.appendChild(form);

			// The input text box
			input = doc.createElement("input");
			input.type = "text";
			input.value = defaultInputText;
			style = input.style;
			style.display = "block";
			style.width = "80%";
			style.marginLeft = style.marginRight = "auto";
			form.appendChild(input);

			// The ok button
			var okButton = doc.createElement("input");
			okButton.type = "button";
			okButton.onclick = function () { return close(false); };
			okButton.value = "OK";
			style = okButton.style;
			style.margin = "10px";
			style.display = "inline";
			style.width = "7em";


			// The cancel button
			var cancelButton = doc.createElement("input");
			cancelButton.type = "button";
			cancelButton.onclick = function () { return close(true); };
			cancelButton.value = "Cancel";
			style = cancelButton.style;
			style.margin = "10px";
			style.display = "inline";
			style.width = "7em";

			form.appendChild(okButton);
			form.appendChild(cancelButton);

			util.addEvent(doc.body, "keydown", checkEscape);
			dialog.style.top = "50%";
			dialog.style.left = "50%";
			dialog.style.display = "block";
			if (uaSniffed.isIE_5or6) {
				dialog.style.position = "absolute";
				dialog.style.top = doc.documentElement.scrollTop + 200 + "px";
				dialog.style.left = "50%";
			}
			doc.body.appendChild(dialog);

			// This has to be done AFTER adding the dialog to the form if you
			// want it to be centered.
			dialog.style.marginTop = -(position.getHeight(dialog) / 2) + "px";
			dialog.style.marginLeft = -(position.getWidth(dialog) / 2) + "px";

		};

		// Why is this in a zero-length timeout?
		// Is it working around a browser bug?
		setTimeout(function () {

			createDialog();

			var defTextLen = defaultInputText.length;
			if (input.selectionStart !== undefined) {
				input.selectionStart = 0;
				input.selectionEnd = defTextLen;
			}
			else if (input.createTextRange) {
				var range = input.createTextRange();
				range.collapse(false);
				range.moveStart("character", -defTextLen);
				range.moveEnd("character", defTextLen);
				range.select();
			}
		}, 0);
	};

	function UIManager(postfix, panels, undoManager, commandManager, getString) {

		var inputBox = panels.input, buttons = {};

		makeSpritedButtonRow();

		var keyEvent = "keydown";
		if (uaSniffed.isOpera) {
			keyEvent = "keypress";
		}

		// Perform the button's action.
		function doClick(button) {

			var linkOrImage = button.id == "wmd-link-button" || button.id == "wmd-image-button";

			if (button.textOp) {

				if (undoManager && !linkOrImage) {
					undoManager.setCommandMode();
				}

				var state = new TextareaState(panels);

				if (!state) {
					return;
				}

				var chunks = state.getChunks();

				// Some commands launch a "modal" prompt dialog.  Javascript
				// can't really make a modal dialog box and the WMD code
				// will continue to execute while the dialog is displayed.
				// This prevents the dialog pattern I'm used to and means
				// I can't do something like this:
				//
				// var link = CreateLinkDialog();
				// makeMarkdownLink(link);
				//
				// Instead of this straightforward method of handling a
				// dialog I have to pass any code which would execute
				// after the dialog is dismissed (e.g. link creation)
				// in a function parameter.
				//
				// Yes this is awkward and I think it sucks, but there's
				// no real workaround.  Only the image and link code
				// create dialogs and require the function pointers.
				var fixupInputArea = function () {

					if (chunks) {
						state.setChunks(chunks);
					}

					state.restore();
				};

				var noCleanup = button.textOp(chunks, fixupInputArea);

				if (!noCleanup) {
					fixupInputArea();
					if(!linkOrImage) {
						inputBox.adjustCursorPosition();
						//inputBox.dispatchEvent(new Event('keydown'));
					}
				}

			}

			if (button.execute) {
				button.execute(undoManager);
			}
		};

		function setupButton(button, isEnabled) {

			var image = button.getElementsByTagName("span")[0];
			button.className = button.className.replace(/ disabled/g, "");
			if (isEnabled) {

				// IE tries to select the background image "button" text (it's
				// implemented in a list item) so we have to cache the selection
				// on mousedown.
				if (uaSniffed.isIE) {
					button.onmousedown = function () {
						panels.ieCachedRange = document.selection.createRange();
						panels.ieCachedScrollTop = panels.input.scrollTop;
					};
				}

				button.onclick = function () {
					if (this.onmouseout) {
						this.onmouseout();
					}
					doClick(this);
					return false;
				}
			}
			else {
				button.className += " disabled";
			}
		}

		function bindCommand(method) {
			if (typeof method === "string")
				method = commandManager[method];
			return function () { method.apply(commandManager, arguments); }
		}

		function makeSpritedButtonRow() {

			var buttonBar = panels.buttonBar;

			var buttonRow = document.createElement("ul");
			buttonRow.id = "wmd-button-row" + postfix;
			buttonRow.className = 'wmd-button-row';
			buttonRow = buttonBar.appendChild(buttonRow);
			var makeButton = function (id, title, textOp) {
				var button = document.createElement("li");
				button.className = "wmd-button";
				var buttonImage = document.createElement("span");
				button.id = id + postfix;
				button.appendChild(buttonImage);
				button.title = title;
				if (textOp)
					button.textOp = textOp;
				setupButton(button, true);
				buttonRow.appendChild(button);
				return button;
			};

			buttons.bold = makeButton("wmd-bold-button", getString("bold"), bindCommand("doBold"));
			buttons.italic = makeButton("wmd-italic-button", getString("italic"), bindCommand("doItalic"));

			buttons.link = makeButton("wmd-link-button", getString("link"), bindCommand(function (chunk, postProcessing) {
				return this.doLinkOrImage(chunk, postProcessing, false);
			}));
			buttons.quote = makeButton("wmd-quote-button", getString("quote"), bindCommand("doBlockquote"));
			buttons.code = makeButton("wmd-code-button", getString("code"), bindCommand("doCode"));
			buttons.image = makeButton("wmd-image-button", getString("image"), bindCommand(function (chunk, postProcessing) {
				return this.doLinkOrImage(chunk, postProcessing, true);
			}));

			buttons.olist = makeButton("wmd-olist-button", getString("olist"), bindCommand(function (chunk, postProcessing) {
				this.doList(chunk, postProcessing, true);
			}));
			buttons.ulist = makeButton("wmd-ulist-button", getString("ulist"), bindCommand(function (chunk, postProcessing) {
				this.doList(chunk, postProcessing, false);
			}));
			buttons.heading = makeButton("wmd-heading-button", getString("heading"), bindCommand("doHeading"));
			buttons.hr = makeButton("wmd-hr-button", getString("hr"), bindCommand("doHorizontalRule"));

			buttons.undo = makeButton("wmd-undo-button", getString("undo"), null);
			buttons.undo.execute = function (manager) { if (manager) manager.undo(); };

			buttons.redo = makeButton("wmd-redo-button", getString("redo"), null);
			buttons.redo.execute = function (manager) { if (manager) manager.redo(); };

			buttons.revert = makeButton("wmd-revert-button", getString("revert"), bindCommand(function () {
				if(localStorage.moratab){
					editor.setValue(localStorage.moratab);
					setTimeout(function(){delete window.localStorage["moratab"];}, 200);
					$(buttons.revert).hide();
				}
			}));
			if (getString('pdf'))
				buttons.pdf = makeButton("wmd-pdf-button", getString("pdf"), bindCommand(function () {
					$('<form>', {
						'method': 'POST',
						'action': 'http://moratab.herokuapp.com/pdf',
						'html': '<textarea name="moratab">'+ editor.getValue() + '</textarea>',
						'style': 'display: none'
					}).appendTo(document.body).submit();
				}));
			if (getString('help'))
				buttons.help = makeButton("wmd-help-button", getString("help"), bindCommand(function () {
					window.open('http://www.sobhe.ir/moratab/', '_blank');
				}));
			setUndoRedoButtonStates();
		}

		function setUndoRedoButtonStates() {
			if (undoManager) {
				setupButton(buttons.undo, undoManager.canUndo());
				setupButton(buttons.redo, undoManager.canRedo());
			}
		};

		this.setUndoRedoButtonStates = setUndoRedoButtonStates;
		this.buttons = buttons;
		this.doClick = doClick;

	}

	function CommandManager(pluginHooks, getString) {
		this.hooks = pluginHooks;
		this.getString = getString;
	}

	var commandProto = CommandManager.prototype;

	// The markdown symbols - 4 spaces = code, > = blockquote, etc.
	commandProto.prefixes = "(?:\\s{4,}|\\s*>|\\s*-\\s+|\\s*\\d+\\.|=|\\+|-|_|\\*|#|\\s*\\[[^\n]]+\\]:)";

	// Remove markdown symbols from the chunk selection.
	commandProto.unwrap = function (chunk) {
		var txt = new re("([^\\n])\\n(?!(\\n|" + this.prefixes + "))", "g");
		chunk.selection = chunk.selection.replace(txt, "$1 $2");
	};

	commandProto.doBold = function (chunk, postProcessing) {
		return this.doBorI(chunk, postProcessing, 2, this.getString("boldexample"));
	};

	commandProto.doItalic = function (chunk, postProcessing) {
		return this.doBorI(chunk, postProcessing, 1, this.getString("italicexample"));
	};

	// chunk: The selected region that will be enclosed with */**
	// nStars: 1 for italics, 2 for bold
	// insertText: If you just click the button without highlighting text, this gets inserted
	commandProto.doBorI = function (chunk, postProcessing, nStars, insertText) {

		// Get rid of whitespace and fixup newlines.
		chunk.trimWhitespace();
		chunk.selection = chunk.selection.replace(/\n{2,}/g, "\n");

		// Look for stars before and after. Is the chunk already marked up? note that these regex matches cannot fail
		var starsBefore = /(\**$)/.exec(chunk.before)[0];
		var starsAfter = /(^\**)/.exec(chunk.after)[0];

		var prevStars = Math.min(starsBefore.length, starsAfter.length);

		// Remove stars if we have to since the button acts as a toggle.
		if ((prevStars >= nStars) && (prevStars != 2 || nStars != 1)) {
			chunk.before = chunk.before.replace(re("[*]{" + nStars + "}$", ""), "");
			chunk.after = chunk.after.replace(re("^[*]{" + nStars + "}", ""), "");
		}
		else if (!chunk.selection && starsAfter) {
			// It's not really clear why this code is necessary.  It just moves some arbitrary stuff around.
			chunk.after = chunk.after.replace(/^([*_]*)/, "");
			chunk.before = chunk.before.replace(/(\s?)$/, "");
			var whitespace = re.$1;
			chunk.before = chunk.before + starsAfter + whitespace;
		}
		else {
			// In most cases, if you don't have any selected text and click the button you'll get a selected, marked up region with the default text inserted.
			if (!chunk.selection && !starsAfter)
				chunk.selection = insertText;

			// Add the true markup.
			var markup = nStars <= 1 ? "*" : "**"; // shouldn't the test be = ?
			chunk.before = chunk.before + markup;
			chunk.after = markup + chunk.after;
		}

		return;
	};

	commandProto.stripLinkDefs = function (text, defsToAdd) {

		text = text.replace(/^[ ]{0,3}\[(\d+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|$)/gm,
			function (totalMatch, id, link, newlines, title) {
				defsToAdd[id] = totalMatch.replace(/\s*$/, "");
				if (newlines) {
					// Strip the title and return that separately.
					defsToAdd[id] = totalMatch.replace(/["(](.+?)[")]$/, "");
					return newlines + title;
				}
				return "";
			});

		return text;
	};

	commandProto.addLinkDef = function (chunk, linkDef) {

		var refNumber = 0; // The current reference number
		var defsToAdd = {}; //
		// Start with a clean slate by removing all previous link definitions.
		chunk.before = this.stripLinkDefs(chunk.before, defsToAdd);
		chunk.selection = this.stripLinkDefs(chunk.selection, defsToAdd);
		chunk.after = this.stripLinkDefs(chunk.after, defsToAdd);

		var defs = "";
		var regex = /(\[)((?:\[[^\]]*\]|[^\[\]])*)(\][ ]?(?:\n[ ]*)?\[)(\d+)(\])/g;

		var addDefNumber = function (def) {
			refNumber++;
			def = def.replace(/^[ ]{0,3}\[(\d+)\]:/, "  [" + refNumber + "]:");
			defs += "\n" + def;
		};

		// note that
		// a) the recursive call to getLink cannot go infinite, because by definition
		//    of regex, inner is always a proper substring of wholeMatch, and
		// b) more than one level of nesting is neither supported by the regex
		//    nor making a lot of sense (the only use case for nesting is a linked image)
		var getLink = function (wholeMatch, before, inner, afterInner, id, end) {
			inner = inner.replace(regex, getLink);
			if (defsToAdd[id]) {
				addDefNumber(defsToAdd[id]);
				return before + inner + afterInner + refNumber + end;
			}
			return wholeMatch;
		};

		chunk.before = chunk.before.replace(regex, getLink);

		if (linkDef) {
			addDefNumber(linkDef);
		}
		else {
			chunk.selection = chunk.selection.replace(regex, getLink);
		}

		var refOut = refNumber;

		chunk.after = chunk.after.replace(regex, getLink);

		if (chunk.after) {
			chunk.after = chunk.after.replace(/\n*$/, "");
		}
		if (!chunk.after) {
			chunk.selection = chunk.selection.replace(/\n*$/, "");
		}

		chunk.after += "\n\n" + defs;

		return refOut;
	};

	// takes the line as entered into the add link/as image dialog and makes
	// sure the URL and the optinal title are "nice".
	function properlyEncoded(linkdef) {
		return linkdef.replace(/^\s*(.*?)(?:\s+"(.+)")?\s*$/, function (wholematch, link, title) {
			link = link.replace(/\?.*$/, function (querypart) {
				return querypart.replace(/\+/g, " "); // in the query string, a plus and a space are identical
			});
			link = decodeURIComponent(link); // unencode first, to prevent double encoding
			link = encodeURI(link).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
			link = link.replace(/\?.*$/, function (querypart) {
				return querypart.replace(/\+/g, "%2b"); // since we replaced plus with spaces in the query part, all pluses that now appear where originally encoded
			});
			if (title) {
				title = title.trim ? title.trim() : title.replace(/^\s*/, "").replace(/\s*$/, "");
				title = title.replace(/"/g, "quot;").replace(/\(/g, "&#40;").replace(/\)/g, "&#41;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			}
			return title ? link + ' "' + title + '"' : link;
		});
	}

	commandProto.doLinkOrImage = function (chunk, postProcessing, isImage) {

		chunk.trimWhitespace();
		//chunk.findTags(/\s*!?\[/, /\][ ]?(?:\n[ ]*)?(\[.*?\])?/);
		chunk.findTags(/\s*!?\[/, /\][ ]?(?:\n[ ]*)?(\(.*?\))?/);

		var background;

		if (chunk.endTag.length > 1 && chunk.startTag.length > 0) {

			chunk.startTag = chunk.startTag.replace(/!?\[/, "");
			chunk.endTag = "";
			this.addLinkDef(chunk, null);

		}
		else {

			// We're moving start and end tag back into the selection, since (as we're in the else block) we're not
			// *removing* a link, but *adding* one, so whatever findTags() found is now back to being part of the
			// link text. linkEnteredCallback takes care of escaping any brackets.
			chunk.selection = chunk.startTag + chunk.selection + chunk.endTag;
			chunk.startTag = chunk.endTag = "";

			if (/\n\n/.test(chunk.selection)) {
				this.addLinkDef(chunk, null);
				return;
			}
			var that = this;
			// The function to be executed when you enter a link and press OK or Cancel.
			// Marks up the link and adds the ref.
			var linkEnteredCallback = function (link) {

				background.parentNode.removeChild(background);

				if (link !== null) {
					// (                          $1
					//     [^\\]                  anything that's not a backslash
					//     (?:\\\\)*              an even number (this includes zero) of backslashes
					// )
					// (?=                        followed by
					//     [[\]]                  an opening or closing bracket
					// )
					//
					// In other words, a non-escaped bracket. These have to be escaped now to make sure they
					// don't count as the end of the link or similar.
					// Note that the actual bracket has to be a lookahead, because (in case of to subsequent brackets),
					// the bracket in one match may be the "not a backslash" character in the next match, so it
					// should not be consumed by the first match.
					// The "prepend a space and finally remove it" steps makes sure there is a "not a backslash" at the
					// start of the string, so this also works if the selection begins with a bracket. We cannot solve
					// this by anchoring with ^, because in the case that the selection starts with two brackets, this
					// would mean a zero-width match at the start. Since zero-width matches advance the string position,
					// the first bracket could then not act as the "not a backslash" for the second.
					chunk.selection = (" " + chunk.selection).replace(/([^\\](?:\\\\)*)(?=[[\]])/g, "$1\\").substr(1);

					/*
					var linkDef = " [999]: " + properlyEncoded(link);

					var num = that.addLinkDef(chunk, linkDef);
					*/
					chunk.startTag = isImage ? "![" : "[";
					//chunk.endTag = "][" + num + "]";
					chunk.endTag = "](" + properlyEncoded(link) + ")";

					if (!chunk.selection) {
						if (isImage) {
							chunk.selection = that.getString("imagedescription");
						}
						else {
							chunk.selection = that.getString("linkdescription");
						}
					}
				}
				postProcessing();
			};

			background = ui.createBackground();

			if (isImage) {
				if (!this.hooks.insertImageDialog(linkEnteredCallback))
					ui.prompt(this.getString("imagedialog"), imageDefaultText, linkEnteredCallback);
			}
			else {
				if (!this.hooks.insertLinkDialog(linkEnteredCallback))
					ui.prompt(this.getString("linkdialog"), linkDefaultText, linkEnteredCallback);
			}
			return true;
		}
	};

	// When making a list, hitting shift-enter will put your cursor on the next line
	// at the current indent level.
	commandProto.doAutoindent = function (chunk, postProcessing) {

		var commandMgr = this,
			fakeSelection = false;

		chunk.before = chunk.before.replace(/(\n|^)[ ]{0,3}([*+-]|\d+[.])[ \t]*\n$/, "\n\n");
		chunk.before = chunk.before.replace(/(\n|^)[ ]{0,3}>[ \t]*\n$/, "\n\n");
		chunk.before = chunk.before.replace(/(\n|^)[ \t]+\n$/, "\n\n");

		// There's no selection, end the cursor wasn't at the end of the line:
		// The user wants to split the current list item / code line / blockquote line
		// (for the latter it doesn't really matter) in two. Temporarily select the
		// (rest of the) line to achieve this.
		if (!chunk.selection && !/^[ \t]*(?:\n|$)/.test(chunk.after)) {
			chunk.after = chunk.after.replace(/^[^\n]*/, function (wholeMatch) {
				chunk.selection = wholeMatch;
				return "";
			});
			fakeSelection = true;
		}

		if (/(\n|^)[ ]{0,3}([*+-]|\d+[.])[ \t]+.*\n$/.test(chunk.before)) {
			if (commandMgr.doList) {
				commandMgr.doList(chunk);
			}
		}
		if (/(\n|^)[ ]{0,3}>[ \t]+.*\n$/.test(chunk.before)) {
			if (commandMgr.doBlockquote) {
				commandMgr.doBlockquote(chunk);
			}
		}
		if (/(\n|^)(\t|[ ]{4,}).*\n$/.test(chunk.before)) {
			if (commandMgr.doCode) {
				commandMgr.doCode(chunk);
			}
		}

		if (fakeSelection) {
			chunk.after = chunk.selection + chunk.after;
			chunk.selection = "";
		}
	};

	commandProto.doBlockquote = function (chunk, postProcessing) {

		chunk.selection = chunk.selection.replace(/^(\n*)([^\r]+?)(\n*)$/,
			function (totalMatch, newlinesBefore, text, newlinesAfter) {
				chunk.before += newlinesBefore;
				chunk.after = newlinesAfter + chunk.after;
				return text;
			});

		chunk.before = chunk.before.replace(/(>[ \t]*)$/,
			function (totalMatch, blankLine) {
				chunk.selection = blankLine + chunk.selection;
				return '';
			});

		chunk.selection = chunk.selection.replace(/^(\s|>)+$/, '');
		chunk.selection = chunk.selection || this.getString('quoteexample');

		// The original code uses a regular expression to find out how much of the
		// text *directly before* the selection already was a blockquote:

		/*
		if (chunk.before) {
		chunk.before = chunk.before.replace(/\n?$/, "\n");
		}
		chunk.before = chunk.before.replace(/(((\n|^)(\n[ \t]*)*>(.+\n)*.*)+(\n[ \t]*)*$)/,
		function (totalMatch) {
		chunk.startTag = totalMatch;
		return "";
		});
		*/

		// This comes down to:
		// Go backwards as many lines a possible, such that each line
		//  a) starts with ">", or
		//  b) is almost empty, except for whitespace, or
		//  c) is preceeded by an unbroken chain of non-empty lines
		//     leading up to a line that starts with ">" and at least one more character
		// and in addition
		//  d) at least one line fulfills a)
		//
		// Since this is essentially a backwards-moving regex, it's susceptible to
		// catstrophic backtracking and can cause the browser to hang;
		// see e.g. http://meta.stackoverflow.com/questions/9807.
		//
		// Hence we replaced this by a simple state machine that just goes through the
		// lines and checks for a), b), and c).

		var match = "",
			leftOver = "",
			line;
		if (chunk.before) {
			var lines = chunk.before.replace(/\n$/, "").split("\n");
			var inChain = false;
			for (var i = 0; i < lines.length; i++) {
				var good = false;
				line = lines[i];
				inChain = inChain && line.length > 0; // c) any non-empty line continues the chain
				if (/^>/.test(line)) {                // a)
					good = true;
					if (!inChain && line.length > 1)  // c) any line that starts with ">" and has at least one more character starts the chain
						inChain = true;
				} else if (/^[ \t]*$/.test(line)) {   // b)
					good = true;
				} else {
					good = inChain;                   // c) the line is not empty and does not start with ">", so it matches if and only if we're in the chain
				}
				if (good) {
					match += line + "\n";
				} else {
					leftOver += match + line;
					match = "\n";
				}
			}
			if (!/(^|\n)>/.test(match)) {             // d)
				leftOver += match;
				match = "";
			}
		}

		chunk.startTag = match;
		chunk.before = leftOver;

		// end of change

		if (chunk.after) {
			chunk.after = chunk.after.replace(/^\n?/, "\n");
		}

		chunk.after = chunk.after.replace(/^(((\n|^)(\n[ \t]*)*>(.+\n)*.*)+(\n[ \t]*)*)/,
			function (totalMatch) {
				chunk.endTag = totalMatch;
				return "";
			}
		);

		var replaceBlanksInTags = function (useBracket) {

			var replacement = useBracket ? "> " : "";

			if (chunk.startTag) {
				chunk.startTag = chunk.startTag.replace(/\n((>|\s)*)\n$/,
					function (totalMatch, markdown) {
						return "\n" + markdown.replace(/^[ ]{0,3}>?[ \t]*$/gm, replacement) + "\n";
					});
			}
			if (chunk.endTag) {
				chunk.endTag = chunk.endTag.replace(/^\n((>|\s)*)\n/,
					function (totalMatch, markdown) {
						return "\n" + markdown.replace(/^[ ]{0,3}>?[ \t]*$/gm, replacement) + "\n";
					});
			}
		};

		if (/^(?![ ]{0,3}>)/m.test(chunk.selection)) {
			chunk.selection = chunk.selection.replace(/^/gm, "> ");
			replaceBlanksInTags(true);
			chunk.skipLines();
		} else {
			chunk.selection = chunk.selection.replace(/^[ ]{0,3}> ?/gm, "");
			this.unwrap(chunk);
			replaceBlanksInTags(false);

			if (!/^(\n|^)[ ]{0,3}>/.test(chunk.selection) && chunk.startTag) {
				chunk.startTag = chunk.startTag.replace(/\n{0,2}$/, "\n\n");
			}

			if (!/(\n|^)[ ]{0,3}>.*$/.test(chunk.selection) && chunk.endTag) {
				chunk.endTag = chunk.endTag.replace(/^\n{0,2}/, "\n\n");
			}
		}

		chunk.selection = this.hooks.postBlockquoteCreation(chunk.selection);

		if (!/\n/.test(chunk.selection)) {
			chunk.selection = chunk.selection.replace(/^(> *)/,
			function (wholeMatch, blanks) {
				chunk.startTag += blanks;
				return "";
			});
		}
	};

	commandProto.doCode = function (chunk, postProcessing) {

		var hasTextBefore = /\S[ ]*$/.test(chunk.before);
		var hasTextAfter = /^[ ]*\S/.test(chunk.after);

		// Use code block if the selection is on its own line or is multiline.
		if ((!hasTextAfter && !hasTextBefore) || /\n/.test(chunk.selection)) {

			chunk.before = chunk.before.replace(/[ ]{4}$/,
				function (totalMatch) {
					chunk.selection = totalMatch + chunk.selection;
					return "";
				});

			var nLinesBack = 1;
			var nLinesForward = 1;

			if (/(\n|^)(\t|[ ]{4,}).*\n$/.test(chunk.before)) {
				nLinesBack = 0;
			}
			if (/^\n(\t|[ ]{4,})/.test(chunk.after)) {
				nLinesForward = 0;
			}

			chunk.skipLines(nLinesBack, nLinesForward);

			if (!chunk.selection) {
				chunk.startTag = "\t";
				chunk.selection = this.getString("codeexample");
			}
			else {
				if (/^[ ]{0,3}\S/m.test(chunk.selection)) {
					if (/\n/.test(chunk.selection))
						chunk.selection = chunk.selection.replace(/^/gm, "    ");
					else // if it's not multiline, do not select the four added spaces; this is more consistent with the doList behavior
						chunk.before += "    ";
				}
				else {
					chunk.selection = chunk.selection.replace(/^(?:[ ]{4}|[ ]{0,3}\t)/gm, "");
				}
			}
		}
		else {
			// Use backticks (`) to delimit the code block.

			chunk.trimWhitespace();
			chunk.findTags(/`/, /`/);

			if (!chunk.startTag && !chunk.endTag) {
				chunk.startTag = chunk.endTag = "`";
				if (!chunk.selection) {
					chunk.selection = this.getString("codeexample");
				}
			}
			else if (chunk.endTag && !chunk.startTag) {
				chunk.before += chunk.endTag;
				chunk.endTag = "";
			}
			else {
				chunk.startTag = chunk.endTag = "";
			}
		}
	};

	commandProto.doList = function (chunk, postProcessing, isNumberedList) {

		// These are identical except at the very beginning and end. Should probably use the regex extension function to make this clearer.
		var previousItemsRegex = /(\n|^)(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*$/;
		var nextItemsRegex = /^\n*(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*/;

		// default prefixes
		var bullet = '+';
		var num = 1;

		var getItemPrefix = function () {
			var prefix;
			if (isNumberedList) {
				prefix = num + '. ';
				num++;
			}
			else
				prefix = bullet + ' ';
			return prefix;
		};

		// Fixes the prefixes of the other list items.
		var getPrefixedItem = function (itemText) {

			// The numbering flag is unset when called by autoindent.
			if (isNumberedList === undefined)
				isNumberedList = /^\s*\d/.test(itemText);

			// Renumber/bullet the list element.
			itemText = itemText.replace(/^[ ]{0,3}([*+-]|\d+[.])\s/gm, function (_) { return getItemPrefix(); });

			return itemText;
		};

		chunk.findTags(/(\n|^)*[ ]{0,3}([*+-]|\d+[.])\s+/, null);

		if (chunk.before && !/\n$/.test(chunk.before) && !/^\n/.test(chunk.startTag)) {
			chunk.before += chunk.startTag;
			chunk.startTag = '';
		}

		if (chunk.startTag) {

			var hasDigits = /\d+[.]/.test(chunk.startTag);
			chunk.startTag = "";
			chunk.selection = chunk.selection.replace(/\n[ ]{4}/g, '\n');
			this.unwrap(chunk);
			chunk.skipLines();

			// Have to renumber the bullet points if this is a numbered list.
			if (hasDigits)
				chunk.after = chunk.after.replace(nextItemsRegex, getPrefixedItem);

			if (isNumberedList == hasDigits)
				return;
		}

		var nLinesUp = 1;
		chunk.before = chunk.before.replace(previousItemsRegex,
			function (itemText) {
				if (/^\s*([*+-])/.test(itemText)) {
					bullet = re.$1;
				}
				nLinesUp = /[^\n]\n\n[^\n]/.test(itemText) ? 1 : 0;
				return getPrefixedItem(itemText);
			});

		if (!chunk.selection)
			chunk.selection = this.getString('litem');

		var prefix = getItemPrefix();

		var nLinesDown = 1;
		chunk.after = chunk.after.replace(nextItemsRegex,
			function (itemText) {
				nLinesDown = /[^\n]\n\n[^\n]/.test(itemText) ? 1 : 0;
				return getPrefixedItem(itemText);
			});

		chunk.trimWhitespace(true);
		chunk.skipLines(nLinesUp, nLinesDown, true);
		chunk.startTag = prefix;
		var spaces = prefix.replace(/./g, ' ');
		chunk.selection = chunk.selection.replace(/\n/g, '\n' + spaces);
	};

	commandProto.doHeading = function (chunk, postProcessing) {

		// Remove leading/trailing whitespace and reduce internal spaces to single spaces.
		chunk.selection = chunk.selection.replace(/\s+/g, ' ');
		chunk.selection = chunk.selection.replace(/(^\s+|\s+$)/g, '');

		// If we clicked the button with no selected text, we just make a level 1 hash header around some default text.
		if (!chunk.selection) {
			chunk.startTag = '# ';
			chunk.selection = this.getString('headingexample');
			chunk.endTag = '';
			return;
		}

		var headerLevel = 0; // The existing header level of the selected text.

		// Remove any existing hash heading markdown and save the header level.
		chunk.findTags(/#+[ ]*/, /[ ]*#+/);
		if (/#+/.test(chunk.startTag))
			headerLevel = re.lastMatch.length;

		// Try to get the current header level by looking for - and = in the line below the selection.
		chunk.findTags(null, /\s?(-+|=+)/);
		if (/=+/.test(chunk.endTag))
			headerLevel = 1;
		if (/-+/.test(chunk.endTag))
			headerLevel = 2;

		// Skip to the next line so we can create the header markdown.
		chunk.startTag = chunk.endTag = '';
		chunk.skipLines(1, 1);

		// Increament header level
		var headerLevelToCreate = headerLevel+1;
		if (headerLevelToCreate < 4) {
			while (headerLevelToCreate--)
				chunk.startTag += '#';
			chunk.startTag += ' ';
		}
	};

	commandProto.doHorizontalRule = function (chunk, postProcessing) {
		chunk.startTag = '----------\n';
		chunk.selection = '';
		chunk.skipLines(2, 1, true);
	}
})();
