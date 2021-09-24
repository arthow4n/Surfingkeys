function createVisual() {
  var self = new Mode("Visual");

  self.addEventListener("keydown", function (event) {
    if (visualf) {
      var exitf = false;
      event.sk_stopPropagation = true;
      event.sk_suppressed = true;

      if (KeyboardUtils.isWordChar(event)) {
        visualSeek(visualf, event.sk_keyName);
        lastF = [visualf, event.sk_keyName];
        exitf = true;
      } else if (Mode.isSpecialKeyOf("<Esc>", event.sk_keyName)) {
        exitf = true;
      }

      if (exitf) {
        self.statusLine = self.name + " - " + status[state];
        Mode.showStatus();
        visualf = 0;
      }
    } else if (event.sk_keyName.length) {
      Mode.handleMapKey.call(self, event);
      if (event.sk_stopPropagation) {
        event.sk_suppressed = true;
      } else if (Mode.isSpecialKeyOf("<Esc>", event.sk_keyName)) {
        if (state > 1) {
          self.hideCursor();
          selection.collapse(selection.anchorNode, selection.anchorOffset);
          self.showCursor();
        } else {
          self.visualClear();
          self.exit();
        }
        state--;
        _onStateChange();
        event.sk_stopPropagation = true;
        event.sk_suppressed = true;
      }
    }
  });

  self.addEventListener("click", function (event) {
    switch (selection.type) {
      case "None":
        self.hideCursor();
        state = 0;
        break;
      case "Caret":
        if (state) {
          self.hideCursor();
          if (state === 0) {
            state = 1;
          }
          self.showCursor();
        }
        break;
      case "Range":
        if (state) {
          self.hideCursor();
          state = 2;
          self.showCursor();
        }
        break;
    }
    _onStateChange();
  });

  self.mappings = new Trie();
  self.map_node = self.mappings;
  self.repeats = "";
  self.mappings.add("l", {
    annotation: "forward character",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("h", {
    annotation: "backward character",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("j", {
    annotation: "forward line",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("k", {
    annotation: "backward line",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("w", {
    annotation: "forward word",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("e", {
    annotation: "forward word",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("b", {
    annotation: "backward word",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add(")", {
    annotation: "forward sentence",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("(", {
    annotation: "backward sentence",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("}", {
    annotation: "forward paragraphboundary",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("{", {
    annotation: "backward paragraphboundary",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("0", {
    annotation: "backward lineboundary",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("$", {
    annotation: "forward lineboundary",
    feature_group: 9,
    code: modifySelection,
  });
  self.mappings.add("G", {
    annotation: "forward documentboundary",
    feature_group: 9,
    code: function () {
      document.scrollingElement.scrollTop =
        document.scrollingElement.scrollHeight;
      if (window.navigator.userAgent.indexOf("Firefox") === -1) {
        modifySelection();
      } else {
        self.hideCursor();
        selection.setPosition(document.body.lastChild, 0);
        self.showCursor();
      }
      if (matches.length) {
        currentOccurrence = matches.length - 1;
        Front.showStatus(2, currentOccurrence + 1 + " / " + matches.length);
      }
    },
  });
  self.mappings.add("gg", {
    annotation: "backward documentboundary",
    feature_group: 9,
    code: function () {
      // there may be some fixed-position div for navbar on top on some pages.
      // so scrollIntoView can not send us top, as it's already in view.
      // explicitly set scrollTop 0 here.
      document.scrollingElement.scrollTop = 0;
      currentOccurrence = 0;
      if (matches.length) {
        Front.showStatus(2, currentOccurrence + 1 + " / " + matches.length);
      }

      if (window.navigator.userAgent.indexOf("Firefox") === -1) {
        modifySelection();
      } else {
        self.hideCursor();
        selection.setPosition(document.body.firstChild, 0);
        self.showCursor();
      }
    },
  });

  self.mappings.add("o", {
    annotation: "Go to Other end of highlighted text",
    feature_group: 9,
    code: function () {
      self.hideCursor();
      var pos = [selection.anchorNode, selection.anchorOffset];
      selection.collapse(selection.focusNode, selection.focusOffset);
      selection.extend(pos[0], pos[1]);
      self.showCursor();
    },
  });
  var _units = {
    w: "word",
    l: "lineboundary",
    s: "sentence",
    p: "paragraphboundary",
  };
  function _selectUnit(w) {
    if (
      window.navigator.userAgent.indexOf("Firefox") === -1 ||
      (w !== "p" && w !== "s")
    ) {
      var unit = _units[w];
      // sentence and paragraphboundary not support in firefox
      // document.getSelection().modify("move", "backward", "paragraphboundary")
      // gets 0x80004001 (NS_ERROR_NOT_IMPLEMENTED)
      selection.modify("move", "backward", unit);
      selection.modify("extend", "forward", unit);
    }
  }
  var _yankFunctions = [
    {},
    {
      annotation: "Yank a word(w) or line(l) or sentence(s) or paragraph(p)",
      feature_group: 9,
      code: function (w) {
        var pos = [selection.focusNode, selection.focusOffset];
        self.hideCursor();
        _selectUnit(w);
        Clipboard.write(selection.toString());
        selection.collapseToStart();
        selection.setPosition(pos[0], pos[1]);
        self.showCursor();
      },
    },
    {
      annotation: "Copy selected text",
      feature_group: 9,
      code: function () {
        var pos = [selection.focusNode, selection.focusOffset];
        Clipboard.write(selection.toString());
        if (runtime.conf.modeAfterYank === "Caret") {
          selection.setPosition(pos[0], pos[1]);
          self.showCursor();
          state = 1;
          _onStateChange();
        } else if (runtime.conf.modeAfterYank === "Normal") {
          state = 2;
          self.toggle();
        }
      },
    },
  ];
  self.mappings.add("*", {
    annotation: "Search word under the cursor",
    feature_group: 9,
    code: function () {
      self.star();
    },
  });
  function clickLink(element, shiftKey) {
    Hints.flashPressedLink(element);
    dispatchMouseEvent(element, ["click"], shiftKey);
  }
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Enter>"), {
    annotation: "Click on node under cursor.",
    feature_group: 9,
    code: function () {
      clickLink(selection.focusNode.parentNode, false);
    },
  });
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Shift-Enter>"), {
    annotation: "Click on node under cursor.",
    feature_group: 9,
    code: function () {
      clickLink(selection.focusNode.parentNode, true);
    },
  });
  self.mappings.add("zz", {
    annotation: "make cursor at center of window.",
    feature_group: 9,
    code: function () {
      var offset = cursor.getBoundingClientRect().top - window.innerHeight / 2;
      self.hideCursor();
      document.scrollingElement.scrollTop += offset;
      self.showCursor();
    },
  });
  self.mappings.add("f", {
    annotation: "Forward to next char.",
    feature_group: 9,
    code: function () {
      self.statusLine = self.name + " - " + status[state] + " - forward";
      Mode.showStatus();
      visualf = 1;
    },
  });
  self.mappings.add("F", {
    annotation: "Backward to next char.",
    feature_group: 9,
    code: function () {
      self.statusLine = self.name + " - " + status[state] + " - backward";
      Mode.showStatus();
      visualf = -1;
    },
  });
  self.mappings.add(";", {
    annotation: "Repeat latest f, F",
    feature_group: 9,
    code: function () {
      if (lastF) {
        visualSeek(lastF[0], lastF[1]);
      }
    },
  });
  self.mappings.add(",", {
    annotation: "Repeat latest f, F in opposite direction",
    feature_group: 9,
    code: function () {
      if (lastF) {
        visualSeek(-lastF[0], lastF[1]);
      }
    },
  });

  self.mappings.add("p", {
    annotation: "Expand selection to parent element",
    feature_group: 9,
    code: function () {
      var p = selection.focusNode;
      while (p !== document.body) {
        p = p.parentElement;
        var textNodes = getTextNodes(p, /./);
        var lastNode = textNodes[textNodes.length - 1];
        var range = selection.getRangeAt(0);
        if (
          range.comparePoint(textNodes[0], 0) === -1 ||
          range.comparePoint(lastNode, lastNode.length) === 1
        ) {
          self.hideCursor();
          state = 2;
          _onStateChange();
          selection.setBaseAndExtent(
            textNodes[0],
            0,
            lastNode,
            lastNode.length
          );
          self.showCursor();
          break;
        }
      }
    },
  });

  self.mappings.add("q", {
    annotation: "Translate word under cursor",
    feature_group: 9,
    code: function () {
      var w = Visual.getWordUnderCursor();

      if (runtime.conf.autoSpeakOnInlineQuery) {
        readText(w);
      }

      var b = cursor.getBoundingClientRect();
      Front.performInlineQuery(
        w,
        {
          top: b.top,
          left: b.left,
          height: b.height,
          width: b.width,
        },
        function (pos, queryResult) {
          Front.showBubble(pos, queryResult, true);
        }
      );
    },
  });

  self.mappings.add("V", {
    annotation: "Select a word(w) or line(l) or sentence(s) or paragraph(p)",
    feature_group: 9,
    code: function (w) {
      self.hideCursor();
      state = 2;
      _onStateChange();
      _selectUnit(w);
      self.showCursor();
    },
  });

  var selection = document.getSelection(),
    matches = [],
    currentOccurrence,
    state = 0,
    status = ["", "Caret", "Range"],
    mark_template = document.createElement("surfingkeys_mark"),
    cursor = document.createElement("div");
  cursor.className = "surfingkeys_cursor";
  cursor.style.zIndex = 2147483298;

  // f in visual mode
  var visualf = 0,
    lastF = null;

  function visualSeek(dir, chr) {
    self.hideCursor();
    var lastPosBeforeF = [selection.anchorNode, selection.anchorOffset];
    if (
      selection.focusNode &&
      selection.focusNode.textContent &&
      selection.focusNode.textContent.length &&
      selection.focusNode.textContent[selection.focusOffset] === chr &&
      dir === 1
    ) {
      // if the char after cursor is the char to find, forward one step.
      selection.setPosition(selection.focusNode, selection.focusOffset + 1);
    }
    if (findNextTextNodeBy(chr, true, dir === -1)) {
      if (state === 1) {
        selection.setPosition(selection.focusNode, selection.focusOffset - 1);
      } else {
        var found = [selection.focusNode, selection.focusOffset - 1];
        selection.collapseToStart();
        selection.setPosition(lastPosBeforeF[0], lastPosBeforeF[1]);
        selection.extend(found[0], found[1]);
      }
    } else {
      selection.setPosition(lastPosBeforeF[0], lastPosBeforeF[1]);
    }
    self.showCursor();
  }

  function getTextNodeByY(y) {
    var node = null;
    var treeWalker = getTextNodes(document.body, /./, 0);
    while (treeWalker.nextNode()) {
      var br = treeWalker.currentNode.parentNode.getBoundingClientRect();
      if (br.top > window.innerHeight * y) {
        node = treeWalker.currentNode;
        break;
      }
    }
    return node;
  }

  self.hideCursor = function () {
    if (document.body.contains(cursor)) {
      cursor.remove();
      document.dispatchEvent(new CustomEvent("surfingkeys:cursorHidden"));
    }
  };

  self.showCursor = function () {
    if (
      selection.focusNode &&
      (selection.focusNode.offsetHeight > 0 ||
        selection.focusNode.parentNode.offsetHeight > 0)
    ) {
      // https://developer.mozilla.org/en-US/docs/Web/API/Selection
      // If focusNode is a text node, this is the number of characters within focusNode preceding the focus. If focusNode is an element, this is the number of child nodes of the focusNode preceding the focus.
      scrollIntoViewIfNeeded(selection.focusNode.parentElement, true);

      var r = getTextRect(selection.focusNode, selection.focusOffset);
      cursor.style.position = "fixed";
      cursor.style.left = r.left + "px";
      if (r.left < 0 || r.left >= window.innerWidth) {
        document.scrollingElement.scrollLeft += r.left - window.innerWidth / 2;
        cursor.style.left = window.innerWidth / 2 + "px";
      } else {
        cursor.style.left = r.left + "px";
      }
      if (r.top < 0 || r.top >= window.innerHeight) {
        document.scrollingElement.scrollTop += r.top - window.innerHeight / 2;
        cursor.style.top = window.innerHeight / 2 + "px";
      } else {
        cursor.style.top = r.top + "px";
      }
      cursor.style.height = r.height + "px";
      cursor.style.width = r.width + "px";

      document.body.appendChild(cursor);
    }
  };
  self.getCursorPixelPos = function () {
    return cursor.getBoundingClientRect();
  };

  function select(found) {
    self.hideCursor();
    if (selection.anchorNode && state === 2) {
      selection.extend(found[0], found[1]);
    } else {
      selection.setPosition(found[0], found[1]);
    }
    self.showCursor();
  }

  function modifySelection() {
    var sel = self.map_node.meta.annotation.split(" ");
    var alter = state === 2 ? "extend" : "move";
    self.hideCursor();
    var prevPos = [selection.focusNode, selection.focusOffset];
    selection.modify(alter, sel[0], sel[1]);

    if (
      prevPos[0] === selection.focusNode &&
      prevPos[1] === selection.focusOffset
    ) {
      selection.modify(alter, sel[0], "word");
    }
    self.showCursor();
  }

  var holder = document.createElement("div");
  function createMatchMark(node1, offset1, node2, offset2) {
    var r = getTextRect(node1, offset1, node2, offset2);
    if (r.width > 0 && r.height > 0) {
      var mark = mark_template.cloneNode(false);
      mark.style.position = "absolute";
      mark.style.zIndex = 2147483298;
      mark.style.left = document.scrollingElement.scrollLeft + r.left + "px";
      mark.style.top = document.scrollingElement.scrollTop + r.top + "px";
      mark.style.width = r.width + "px";
      mark.style.height = r.height + "px";
      holder.appendChild(mark);
      if (!document.documentElement.contains(holder)) {
        document.documentElement.prepend(holder);
      }

      matches.push([node1, offset1, mark]);
    }
  }

  function highlight(pattern) {
    getTextNodes(document.body, pattern).forEach(function (node) {
      var mtches;
      while ((mtches = pattern.exec(node.data)) !== null) {
        var match = mtches[0];
        if (match.length) {
          var pos = pattern.lastIndex - match.length;
          createMatchMark(node, pos, node, pos + match.length);
        } else {
          // matches like \b
          break;
        }
      }
    });
    if (matches.length === 0) {
      // find across nodes with window.find if no found within each node.
      selection.setPosition(null, 0);
      while (
        findNextTextNodeBy(
          pattern.source,
          pattern.flags.indexOf("i") === -1,
          false
        )
      ) {
        if (selection.anchorNode !== selection.focusNode) {
          createMatchMark(
            selection.anchorNode,
            selection.anchorOffset,
            selection.focusNode,
            selection.focusOffset
          );
        }
      }
    }
    if (matches.length) {
      currentOccurrence = 0;
      for (var i = 0; i < matches.length; i++) {
        var br = matches[i][2].getBoundingClientRect();
        if (br.top > 0) {
          currentOccurrence = i;
          break;
        }
      }
      Front.showStatus(2, currentOccurrence + 1 + " / " + matches.length);
    }
  }

  self.visualClear = function () {
    self.hideCursor();
    matches = [];
    registeredScrollNodes.forEach(function (n) {
      n.onscroll = null;
    });
    registeredScrollNodes = [];
    setSanitizedContent(holder, "");
    holder.remove();
    Front.showStatus(2, "");
  };

  function onCursorHiden() {
    Front.hideBubble();
  }

  self.onEnter = function () {
    document.addEventListener("surfingkeys:cursorHidden", onCursorHiden);
    _incState();
  };

  self.onExit = function () {
    document.removeEventListener("surfingkeys:cursorHidden", onCursorHiden);
  };

  function _onStateChange() {
    self.mappings.add("y", _yankFunctions[state]);
    self.statusLine = self.name + " - " + status[state];
    Mode.showStatus();
  }
  function _incState() {
    state = (state + 1) % 3;
    _onStateChange();
  }

  function getSentence(textNode, offset) {
    var sentence = "";

    actionWithSelectionPreserved(function (sel) {
      sel.setPosition(textNode, offset);
      sel.modify("extend", "backward", "sentence");
      sel.collapseToStart();
      sel.modify("extend", "forward", "sentence");

      sentence = sel.toString();
    });

    return sentence.replace(/\n/g, "");
  }

  self.restore = function () {
    if (selection && selection.anchorNode) {
      selection.setPosition(selection.anchorNode, selection.anchorOffset);
      self.showCursor();
      self.enter();
    }
  };
  self.toggle = function (ex) {
    switch (state) {
      case 1:
        selection.extend(selection.anchorNode, selection.anchorOffset);
        _incState();
        break;
      case 2:
        self.hideCursor();
        selection.collapse(selection.focusNode, selection.focusOffset);
        self.exit();
        _incState();
        break;
      default:
        if (ex === "ym") {
          var textToYank = [];
          Hints.create(
            runtime.conf.textAnchorPat,
            function (element) {
              textToYank.push(element[2].trim());
              Clipboard.write(textToYank.join("\n"));
            },
            { multipleHits: true }
          );
        } else {
          Hints.create(runtime.conf.textAnchorPat, function (element) {
            if (ex === "y") {
              Clipboard.write(
                element[1] === 0 ? element[0].data.trim() : element[2].trim()
              );
            } else if (ex === "q") {
              var word = element[2]
                .trim()
                .replace(
                  /[^A-Za-z\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC].*$/,
                  ""
                );
              var b = getTextNodePos(element[0], element[1], element[2].length);
              if (document.dictEnabled !== undefined) {
                window.postMessage({
                  type: "OpenDictoriumQuery",
                  word: word,
                  sentence: getSentence(element[0], element[1]),
                  pos: b,
                  source: window.location.href,
                });
              } else {
                Front.performInlineQuery(
                  word,
                  {
                    top: b.top,
                    left: b.left,
                    height: b.height,
                    width: b.width,
                  },
                  function (pos, queryResult) {
                    Front.showBubble(pos, queryResult, false);
                  }
                );
              }
            } else {
              setTimeout(function () {
                selection.setPosition(element[0], element[1]);
                self.enter();
                if (ex === "z") {
                  selection.extend(element[0], element[1] + element[2].length);
                  _incState();
                }
                self.showCursor();
              }, 0);
            }
          });
        }
        break;
    }
  };

  self.star = function () {
    if (selection.focusNode && selection.focusNode.nodeValue) {
      var query = self.getWordUnderCursor();
      if (query.length && query !== ".") {
        self.hideCursor();
        var pos = [selection.focusNode, selection.focusOffset];
        runtime.updateHistory("find", query);
        self.visualClear();
        highlight(
          new RegExp(query, "g" + (runtime.getCaseSensitive(query) ? "" : "i"))
        );
        selection.setPosition(pos[0], pos[1]);
        self.showCursor();
      }
    }
  };

  self.getWordUnderCursor = function () {
    var word = selection.toString();
    if (word.length === 0 && selection.focusNode) {
      var pe = selection.focusNode;
      var r = getNearestWord(pe.textContent, selection.focusOffset);
      word = pe.textContent.substr(r[0], r[1]);
    }
    return word;
  };

  self.next = function (backward) {
    if (matches.length) {
      // need enter visual mode again when modeAfterYank is set to Normal / Caret.
      if (state === 0) {
        self.enter();
      }
      currentOccurrence =
        (backward
          ? matches.length + currentOccurrence - 1
          : currentOccurrence + 1) % matches.length;
      select(matches[currentOccurrence]);
      Front.showStatus(2, currentOccurrence + 1 + " / " + matches.length);
    } else if (runtime.conf.lastQuery) {
      highlight(
        new RegExp(
          runtime.conf.lastQuery,
          "g" + (runtime.getCaseSensitive(runtime.conf.lastQuery) ? "" : "i")
        )
      );
      self.visualEnter(runtime.conf.lastQuery);
    }
  };

  self.feedkeys = function (keys) {
    setTimeout(function () {
      var evt = new Event("keydown");
      for (var i = 0; i < keys.length; i++) {
        evt.sk_keyName = keys[i];
        Mode.handleMapKey.call(self, evt);
      }
    }, 1);
  };

  function findNextTextNodeBy(query, caseSensitive, backwards) {
    var found = false;
    // window.find sometimes does not move selection forward
    var firstNode = null;
    while (window.find(query, caseSensitive, backwards)) {
      if (selection.anchorNode.splitText) {
        found = true;
        break;
      } else if (firstNode === null) {
        firstNode = selection.anchorNode;
      } else if (firstNode === selection.anchorNode) {
        break;
      }
    }
    return found;
  }
  self.visualUpdateForContentWindow = function (query) {
    self.visualClear();

    // set caret to top in view
    selection.setPosition(getTextNodeByY(0), 0);

    var scrollTop = document.scrollingElement.scrollTop,
      posToStartFind = [selection.anchorNode, selection.anchorOffset];

    var caseSensitive = runtime.getCaseSensitive(query);
    if (findNextTextNodeBy(query, caseSensitive, false)) {
      selection.setPosition(posToStartFind[0], posToStartFind[1]);
    } else {
      // start from beginning if no found from current position
      selection.setPosition(document.body.firstChild, 0);
    }

    if (findNextTextNodeBy(query, caseSensitive, false)) {
      if (document.scrollingElement.scrollTop !== scrollTop) {
        // set new start position if there is no occurrence in current view.
        scrollTop = document.scrollingElement.scrollTop;
        posToStartFind = [selection.anchorNode, selection.anchorOffset];
      }
      createMatchMark(
        selection.anchorNode,
        selection.anchorOffset,
        selection.focusNode,
        selection.focusOffset
      );

      while (
        document.scrollingElement.scrollTop === scrollTop &&
        findNextTextNodeBy(query, caseSensitive, false)
      ) {
        createMatchMark(
          selection.anchorNode,
          selection.anchorOffset,
          selection.focusNode,
          selection.focusOffset
        );
      }
      document.scrollingElement.scrollTop = scrollTop;
      selection.setPosition(posToStartFind[0], posToStartFind[1]);
    }
  };

  // this is only for finding in frontend.html, like in usage popover.
  self.visualUpdate = function (query) {
    if (query.length && query !== ".") {
      self.visualClear();
      highlight(
        new RegExp(query, "g" + (runtime.getCaseSensitive(query) ? "" : "i"))
      );
    }
  };

  var registeredScrollNodes = [];
  self.visualEnter = function (query) {
    if (query.length === 0 || query === ".") {
      return;
    }
    self.visualClear();
    highlight(
      new RegExp(query, "g" + (runtime.getCaseSensitive(query) ? "" : "i"))
    );
    if (matches.length) {
      self.enter();
      select(matches[currentOccurrence]);
    } else {
      Front.showStatus(2, "Pattern not found: {0}".format(query), 1000);
    }
    Normal.getScrollableElements().forEach(function (n) {
      if (n !== document.scrollingElement) {
        n.onscroll = function () {
          matches.forEach(function (m) {
            var r = getTextRect(m[0], m[1]);
            m[2].style.left =
              document.scrollingElement.scrollLeft + r.left + "px";
            m[2].style.top = document.scrollingElement.scrollTop + r.top + "px";
          });
        };
        registeredScrollNodes.push(n);
      }
    });
  };

  self.findSentenceOf = function (query) {
    var wr = new RegExp("\\b" + query + "\\b");
    var elements = getVisibleElements(function (e, v) {
      if (wr.test(e.innerText)) {
        v.push(e);
      }
    });
    elements = filterAncestors(elements);

    var sentence = "";
    actionWithSelectionPreserved(function (selection) {
      selection.setPosition(elements[0], 0);
      if (window.find(query, false, false, true, true)) {
        _selectUnit("s");
        sentence = selection.toString();
      }
    });
    return sentence;
  };

  var _style = {};
  self.style = function (element, style) {
    _style[element] = style;

    cursor.setAttribute("style", _style.cursor || "");
    mark_template.setAttribute("style", _style.marks || "");
  };
  return self;
}
