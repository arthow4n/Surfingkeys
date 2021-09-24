function createInsert() {
  var self = new Mode("Insert");

  function moveCusorEOL() {
    var element = getRealEdit();
    if (element.setSelectionRange !== undefined) {
      try {
        element.setSelectionRange(element.value.length, element.value.length);
      } catch (err) {
        if (err instanceof DOMException && err.name === "InvalidStateError") {
          // setSelectionRange does not apply
        } else {
          throw err;
        }
      }
    } else if (isEditable(element)) {
      // for contenteditable div
      if (element.childNodes.length > 0) {
        var node = element.childNodes[element.childNodes.length - 1];
        if (node.nodeType === Node.TEXT_NODE) {
          document.getSelection().setPosition(node, node.data.length);
        } else {
          document.getSelection().setPosition(node, node.childNodes.length);
        }
        // blink cursor to bring cursor into view
        Visual.showCursor();
        Visual.hideCursor();
      }
    }
  }

  self.mappings = new Trie();
  self.map_node = self.mappings;
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Ctrl-e>"), {
    annotation: "Move the cursor to the end of the line",
    feature_group: 15,
    code: moveCusorEOL,
  });
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Ctrl-f>"), {
    annotation: "Move the cursor to the beginning of the line",
    feature_group: 15,
    code: function () {
      var element = getRealEdit();
      if (element.setSelectionRange !== undefined) {
        element.setSelectionRange(0, 0);
      } else {
        // for contenteditable div
        var selection = document.getSelection();
        selection.setPosition(selection.focusNode, 0);
        // blink cursor to bring cursor into view
        Visual.showCursor();
        Visual.hideCursor();
      }
    },
  });
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Ctrl-u>"), {
    annotation: "Delete all entered characters before the cursor",
    feature_group: 15,
    code: function () {
      var element = getRealEdit();
      if (element.setSelectionRange !== undefined) {
        element.value = element.value.substr(element.selectionStart);
        element.setSelectionRange(0, 0);
      } else {
        // for contenteditable div
        var selection = document.getSelection();
        selection.focusNode.data = selection.focusNode.data.substr(
          selection.focusOffset
        );
      }
    },
  });
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Alt-b>"), {
    annotation: "Move the cursor Backward 1 word",
    feature_group: 15,
    code: function () {
      var element = getRealEdit();
      if (element.setSelectionRange !== undefined) {
        var pos = nextNonWord(element.value, -1, element.selectionStart);
        element.setSelectionRange(pos, pos);
      } else {
        // for contenteditable div
        document.getSelection().modify("move", "backward", "word");
      }
    },
  });
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Alt-f>"), {
    annotation: "Move the cursor Forward 1 word",
    feature_group: 15,
    code: function () {
      var element = getRealEdit();
      if (element.setSelectionRange !== undefined) {
        var pos = nextNonWord(element.value, 1, element.selectionStart);
        element.setSelectionRange(pos, pos);
      } else {
        // for contenteditable div
        document.getSelection().modify("move", "forward", "word");
      }
    },
  });
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Alt-w>"), {
    annotation: "Delete a word backwards",
    feature_group: 15,
    code: function () {
      var element = getRealEdit();
      if (element.setSelectionRange !== undefined) {
        var pos = deleteNextWord(element.value, -1, element.selectionStart);
        element.value = pos[0];
        element.setSelectionRange(pos[1], pos[1]);
      } else {
        // for contenteditable div
        var selection = document.getSelection();
        var p0 = selection.focusOffset;
        document.getSelection().modify("move", "backward", "word");
        var v = selection.focusNode.data,
          p1 = selection.focusOffset;
        selection.focusNode.data = v.substr(0, p1) + v.substr(p0);
        selection.setPosition(selection.focusNode, p1);
      }
    },
  });
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Alt-d>"), {
    annotation: "Delete a word forwards",
    feature_group: 15,
    code: function () {
      var element = getRealEdit();
      if (element.setSelectionRange !== undefined) {
        var pos = deleteNextWord(element.value, 1, element.selectionStart);
        element.value = pos[0];
        element.setSelectionRange(pos[1], pos[1]);
      } else {
        // for contenteditable div
        var selection = document.getSelection();
        var p0 = selection.focusOffset;
        document.getSelection().modify("move", "forward", "word");
        var v = selection.focusNode.data,
          p1 = selection.focusOffset;
        selection.focusNode.data = v.substr(0, p0) + v.substr(p1);
        selection.setPosition(selection.focusNode, p0);
      }
    },
  });
  self.mappings.add(KeyboardUtils.encodeKeystroke("<Esc>"), {
    annotation: "Exit insert mode",
    feature_group: 15,
    stopPropagation: function (key) {
      // return true only if bind key is not an ASCII key
      // so that imap(',,', "<Esc>") won't leave a comma in input
      return key.charCodeAt(0) < 256;
    },
    code: function () {
      getRealEdit().blur();
      self.exit();
    },
  });

  var _emojiDiv = createElementWithContent("div", "", {
      id: "sk_emoji",
      style: "display: block; opacity: 1;",
    }),
    _emojiList,
    _emojiPending = -1;

  self.mappings.add(":", {
    annotation: "Input emoji",
    feature_group: 15,
    stopPropagation: function () {
      return false;
    },
    code: function () {
      var element = getRealEdit();
      if (element.selectionStart !== undefined) {
        _emojiPending = element.selectionStart + 1;
      } else {
        _emojiPending = document.getSelection().focusOffset + 1;
      }
      fetch(chrome.extension.getURL("pages/emoji.tsv"))
        .then((res) => Promise.all([res.text()]))
        .then((res) => {
          _emojiList = res[0].split("\n");
          listEmoji();
        });
    },
  });

  function listEmoji() {
    var input = getRealEdit(),
      query = "",
      isInput = true;
    if (input.selectionStart !== undefined && input.value !== undefined) {
      query = input.value.substr(
        _emojiPending,
        input.selectionStart - _emojiPending
      );
    } else {
      // for contenteditable div
      isInput = false;
      var selection = document.getSelection();
      query = selection.focusNode.data.substr(
        _emojiPending,
        selection.focusOffset - _emojiPending
      );
    }
    if (query.length < runtime.conf.startToShowEmoji || query[0] === " ") {
      _emojiDiv.remove();
    } else {
      var emojiMatched = _emojiList
        .filter(function (emoji) {
          return emoji.indexOf(query) !== -1;
        })
        .slice(0, 5)
        .map(function (emoji) {
          var ee = emoji.split("\t");
          var parsedUnicodeEmoji = String.fromCodePoint.apply(
            null,
            ee[0].split(",")
          );
          return "<div><span>{0}</span>{1}</div>".format(
            parsedUnicodeEmoji,
            ee[1]
          );
        })
        .join("");

      if (emojiMatched === "") {
        _emojiDiv.remove();
      } else {
        setSanitizedContent(_emojiDiv, emojiMatched);
        document.body.append(_emojiDiv);
        _emojiDiv.style.display = "";
        _emojiDiv.querySelector("#sk_emoji>div").classList.add("selected");
        var br;
        if (isInput) {
          br = getCursorPixelPos(input);
        } else {
          Visual.showCursor();
          br = Visual.getCursorPixelPos();
          Visual.hideCursor();
        }
        var top = br.top + br.height + 4;
        if (window.innerHeight - top < _emojiDiv.offsetHeight) {
          top = br.top - _emojiDiv.offsetHeight;
        }

        _emojiDiv.style.position = "fixed";
        _emojiDiv.style.top = top + "px";
        _emojiDiv.style.left = br.left + "px";
      }
    }
  }

  function getCursorPixelPos(input) {
    var css = getComputedStyle(input),
      br = input.getBoundingClientRect(),
      mask = document.createElement("div"),
      span = document.createElement("span");
    mask.style.font = css.font;
    mask.style.position = "fixed";
    setSanitizedContent(mask, input.value);
    mask.style.left = input.clientLeft + br.left + "px";
    mask.style.top = input.clientTop + br.top + "px";
    mask.style.color = "red";
    mask.style.overflow = "scroll";
    mask.style.visibility = "hidden";
    mask.style.whiteSpace = "pre-wrap";
    mask.style.padding = css.padding;
    mask.style.width = css.width;
    mask.style.height = css.height;
    span.innerText = "I";

    var pos = input.selectionStart;
    if (pos === input.value.length) {
      mask.appendChild(span);
    } else {
      var fp = mask.childNodes[0].splitText(pos);
      mask.insertBefore(span, fp);
    }
    document.body.appendChild(mask);
    scrollIntoViewIfNeeded(span);

    br = span.getBoundingClientRect();

    mask.remove();
    return br;
  }

  function rotateResult(backward) {
    var si = _emojiDiv.querySelector("#sk_emoji>div.selected");
    var _items = Array.from(_emojiDiv.querySelectorAll("#sk_emoji>div"));
    var ci = (_items.indexOf(si) + (backward ? -1 : 1)) % _items.length;
    si.classList.remove("selected");
    _items[ci].classList.add("selected");
  }

  var _suppressKeyup = false;
  self.addEventListener("keydown", function (event) {
    if (event.key && event.key.charCodeAt(0) > 127) {
      // IME is opened.
      event.sk_suppressed = true;
      return;
    }
    // prevent this event to be handled by Surfingkeys' other listeners
    var realTarget = getRealEdit(event);
    if (_emojiDiv.offsetHeight > 0) {
      if (Mode.isSpecialKeyOf("<Esc>", event.sk_keyName)) {
        _emojiDiv.remove();
        _emojiPending = -1;
      } else if (
        event.keyCode === KeyboardUtils.keyCodes.tab ||
        event.keyCode === KeyboardUtils.keyCodes.upArrow ||
        event.keyCode === KeyboardUtils.keyCodes.downArrow
      ) {
        rotateResult(
          event.shiftKey || event.keyCode === KeyboardUtils.keyCodes.upArrow
        );
        _suppressKeyup = true;
        event.sk_stopPropagation = true;
      } else if (event.keyCode === KeyboardUtils.keyCodes.enter) {
        var emoji = _emojiDiv.querySelector(
          "#sk_emoji>div.selected>span"
        ).innerHTML;
        if (realTarget.setSelectionRange !== undefined) {
          var val = realTarget.value;
          realTarget.value =
            val.substr(0, _emojiPending - 1) +
            emoji +
            val.substr(realTarget.selectionStart);
          realTarget.setSelectionRange(_emojiPending, _emojiPending);
        } else {
          // for contenteditable div
          var selection = document.getSelection(),
            val = selection.focusNode.data;
          selection.focusNode.data =
            val.substr(0, _emojiPending - 1) +
            emoji +
            val.substr(selection.focusOffset);
          selection.setPosition(selection.focusNode, _emojiPending);
        }

        _emojiDiv.remove();
        _emojiPending = -1;
        event.sk_stopPropagation = true;
      }
    } else if (!isEditable(realTarget)) {
      self.exit();
    } else if (event.sk_keyName.length) {
      Mode.handleMapKey.call(self, event, function (last) {
        // for insert mode to insert unmapped chars with preceding chars same as some mapkeys
        // such as, to insert `,m` in case of mapkey `,,` defined.
        var pw = last.getPrefixWord();
        if (pw) {
          var elm = getRealEdit(),
            str = elm.value,
            pos = elm.selectionStart;
          if (str !== undefined && pos !== undefined) {
            elm.value =
              str.substr(0, elm.selectionStart) +
              pw +
              str.substr(elm.selectionEnd);
            pos += pw.length;
            elm.setSelectionRange(pos, pos);
          } else {
            elm = document.getSelection();
            var range = elm.getRangeAt(0);
            var n = document.createTextNode(pw);
            if (elm.type === "Caret") {
              str = elm.focusNode.data;
              if (str === undefined) {
                range.insertNode(n);
                elm.setPosition(n, n.length);
              } else {
                pos = elm.focusOffset;
                elm.focusNode.data = str.substr(0, pos) + pw + str.substr(pos);
                elm.setPosition(elm.focusNode, pos + pw.length);
              }
            } else {
              range.deleteContents();
              range.insertNode(n);
              elm.setPosition(n, n.length);
            }
          }
        }
      });
    }
    event.sk_suppressed = true;
  });
  self.addEventListener("keyup", function (event) {
    var realTarget = getRealEdit(event);
    if (!_suppressKeyup && _emojiPending !== -1) {
      var v, ss;
      if (
        realTarget.selectionStart !== undefined &&
        realTarget.value !== undefined
      ) {
        v = realTarget.value;
        ss = realTarget.selectionStart;
      } else {
        // for contenteditable div
        var selection = document.getSelection();
        v = selection.focusNode.data;
        ss = selection.focusOffset;
      }
      if (ss < _emojiPending || v[_emojiPending - 1] !== ":") {
        _emojiDiv.remove();
      } else {
        listEmoji();
      }
    }
    _suppressKeyup = false;
  });
  self.addEventListener("focus", function (event) {
    var realTarget = getRealEdit(event);
    // We get a focus event with target = window when the browser window looses focus.
    // Ignore this event.
    if (event.target != window && !isEditable(realTarget)) {
      self.exit();
    } else {
      event.sk_suppressed = true;
    }
  });

  function nextNonWord(str, dir, cur) {
    var nonWord =
      /[^A-Za-z\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/;
    cur = dir > 0 ? cur : cur + dir;
    for (;;) {
      if (cur < 0) {
        cur = 0;
        break;
      } else if (cur >= str.length) {
        cur = str.length;
        break;
      } else if (nonWord.test(str[cur])) {
        break;
      } else {
        cur = cur + dir;
      }
    }
    return cur;
  }

  function deleteNextWord(str, dir, cur) {
    var pos = nextNonWord(str, dir, cur);
    var s = str;
    if (pos > cur) {
      s = str.substr(0, cur) + str.substr(pos);
    } else if (pos < cur) {
      s = str.substr(0, pos) + str.substr(cur);
    } else {
      s = str.substr(0, pos) + str.substr(pos + 1);
    }
    return [s, dir > 0 ? cur : pos];
  }

  var _element;
  var _enter = self.enter;
  self.enter = function (elm, keepCursor) {
    if (elm === document.body) {
      runtime.conf.showModeStatus = false;
    }
    var changed = _enter.call(self) === -1;
    if (_element !== elm) {
      _element = elm;
      changed = true;
    }
    if (
      changed &&
      !keepCursor &&
      runtime.conf.cursorAtEndOfInput &&
      elm.nodeName !== "SELECT"
    ) {
      moveCusorEOL();
    }
  };

  return self;
}
