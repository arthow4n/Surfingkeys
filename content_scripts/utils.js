function isInUIFrame() {
  return document.location.href.indexOf(chrome.extension.getURL("")) === 0;
}

function timeStampString(t) {
  var dt = new Date();
  dt.setTime(t);
  return dt.toLocaleString();
}

function getDocumentOrigin() {
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
  // Lastly, posting a message to a page at a file: URL currently requires that the targetOrigin argument be "*".
  // file:// cannot be used as a security restriction; this restriction may be modified in the future.
  // Firefox provides window.origin instead of document.origin.
  var origin = window.location.origin ? window.location.origin : "*";
  if (origin === "file://" || origin === "null") {
    origin = "*";
  }
  return origin;
}

function generateQuickGuid() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

function listElements(root, whatToShow, filter) {
  const elms = [];
  let currentNode;
  const nodeIterator = document.createNodeIterator(root, whatToShow, null);

  while ((currentNode = nodeIterator.nextNode())) {
    filter(currentNode) && elms.push(currentNode);

    if (currentNode.shadowRoot) {
      elms.push(...listElements(currentNode.shadowRoot, whatToShow, filter));
    }
  }

  return elms;
}

function isElementVisible(elm) {
  return elm.offsetHeight > 0 && elm.offsetWidth > 0;
}

function isElementClickable(e) {
  var cssSelector =
    "a, button, select, input, textarea, summary, *[onclick], *[contenteditable=true], *.jfk-button, *.goog-flat-menu-button, *[role=button], *[role=link], *[role=menuitem], *[role=option], *[role=switch], *[role=tab], *[role=checkbox], *[role=combobox], *[role=menuitemcheckbox], *[role=menuitemradio]";
  if (runtime.conf.clickableSelector.length) {
    cssSelector += ", " + runtime.conf.clickableSelector;
  }

  return (
    e.matches(cssSelector) ||
    getComputedStyle(e).cursor === "pointer" ||
    getComputedStyle(e).cursor.substr(0, 4) === "url(" ||
    e.closest(
      "a, *[onclick], *[contenteditable=true], *.jfk-button, *.goog-flat-menu-button"
    ) !== null
  );
}

function dispatchMouseEvent(element, events, shiftKey) {
  events.forEach(function (eventName) {
    var mouseButton = shiftKey ? 1 : 0;
    var event = new MouseEvent(eventName, {
      bubbles: true,
      cancelable: true,
      view: window,
      button: mouseButton,
    });
    element.dispatchEvent(event);
  });
}

function getRealEdit(event) {
  var rt = event ? event.target : document.activeElement;
  // on some pages like chrome://history/, input is in shadowRoot of several other recursive shadowRoots.
  while (rt && rt.shadowRoot) {
    if (rt.shadowRoot.activeElement) {
      rt = rt.shadowRoot.activeElement;
    } else if (rt.shadowRoot.querySelector("input, textarea, select")) {
      rt = rt.shadowRoot.querySelector("input, textarea, select");
      break;
    } else {
      break;
    }
  }
  if (rt === window) {
    rt = document.body;
  }
  return rt;
}

function toggleQuote() {
  var elm = getRealEdit(),
    val = elm.value;
  if (val.match(/^"|"$/)) {
    elm.value = val.replace(/^"?(.*?)"?$/, "$1");
  } else {
    elm.value = '"' + val + '"';
  }
}

function isEditable(element) {
  return (
    element &&
    !element.disabled &&
    (element.localName === "textarea" ||
      element.localName === "select" ||
      element.isContentEditable ||
      element.matches(runtime.conf.editableSelector) ||
      (element.localName === "input" &&
        /^(?!button|checkbox|file|hidden|image|radio|reset|submit)/i.test(
          element.type
        )))
  );
}

function parseQueryString(query) {
  var params = {};
  if (query.length) {
    var parts = query.split("&");
    for (var i = 0, ii = parts.length; i < ii; ++i) {
      var param = parts[i].split("=");
      var key = param[0].toLowerCase();
      var value = param.length > 1 ? param[1] : null;
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  return params;
}

function reportIssue(title, description) {
  title = encodeURIComponent(title);
  description =
    "%23%23+Error+details%0A%0A{0}%0A%0ASurfingKeys%3A+{1}%0A%0AChrome%3A+{2}%0A%0AURL%3A+{3}%0A%0A%23%23+Context%0A%0A%2A%2APlease+replace+this+with+a+description+of+how+you+were+using+SurfingKeys.%2A%2A".format(
      encodeURIComponent(description),
      chrome.runtime.getManifest().version,
      encodeURIComponent(navigator.userAgent),
      encodeURIComponent(window.location.href)
    );
  var error =
    '<h2>Uh-oh! The SurfingKeys extension encountered a bug.</h2> <p>Please click <a href="https://github.com/brookhong/Surfingkeys/issues/new?title={0}&body={1}" target=_blank>here</a> to start filing a new issue, append a description of how you were using SurfingKeys before this message appeared, then submit it.  Thanks for your help!</p>'.format(
      title,
      description
    );

  Front.showPopup(error);
}

function scrollIntoViewIfNeeded(elm, ignoreSize) {
  if (elm.scrollIntoViewIfNeeded) {
    elm.scrollIntoViewIfNeeded();
  } else if (!isElementPartiallyInViewport(elm, ignoreSize)) {
    elm.scrollIntoView();
  }
}

function isElementDrawn(e, rect) {
  var min = isEditable(e) ? 1 : 4;
  rect = rect || e.getBoundingClientRect();
  return rect.width > min && rect.height > min;
}

function isElementPartiallyInViewport(el, ignoreSize) {
  var rect = el.getBoundingClientRect();
  var windowHeight =
    window.innerHeight || document.documentElement.clientHeight;
  var windowWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    (ignoreSize || isElementDrawn(el, rect)) &&
    rect.top < windowHeight &&
    rect.bottom > 0 &&
    rect.left < windowWidth &&
    rect.right > 0
  );
}

function getVisibleElements(filter) {
  var all = Array.from(document.documentElement.getElementsByTagName("*"));
  var visibleElements = [];
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    // include elements in a shadowRoot.
    if (e.shadowRoot) {
      var cc = e.shadowRoot.querySelectorAll("*");
      for (var j = 0; j < cc.length; j++) {
        all.push(cc[j]);
      }
    }
    var rect = e.getBoundingClientRect();
    if (
      rect.top <= window.innerHeight &&
      rect.bottom >= 0 &&
      rect.left <= window.innerWidth &&
      rect.right >= 0 &&
      rect.height > 0 &&
      getComputedStyle(e).visibility !== "hidden"
    ) {
      filter(e, visibleElements);
    }
  }
  return visibleElements;
}

function actionWithSelectionPreserved(cb) {
  var selection = document.getSelection();
  var pos = [
    selection.type,
    selection.anchorNode,
    selection.anchorOffset,
    selection.focusNode,
    selection.focusOffset,
  ];

  var dt = document.scrollingElement.scrollTop;

  cb(selection);

  document.scrollingElement.scrollTop = dt;

  if (pos[0] === "None") {
    selection.empty();
  } else if (pos[0] === "Caret") {
    selection.setPosition(pos[3], pos[4]);
  } else if (pos[0] === "Range") {
    selection.setPosition(pos[1], pos[2]);
    selection.extend(pos[3], pos[4]);
  }
}

function last(array) {
  return array[array.length - 1];
}

/**
 * According to a discussion here: https://github.com/brookhong/Surfingkeys/pull/1136
 * @param elements array of elements to filter passed in the order like:
 * parent 1 > parent 0> child
 */
function filterAncestors(elements) {
  if (elements.length === 0) {
    return elements;
  }

  // filter out element which has its children covered
  var result = [];
  elements.forEach(function (e, i) {
    if (isExplicitlyRequested(e)) {
      result.push(e);
    } else {
      for (var j = 0; j < result.length; j++) {
        if (result[j].contains(e)) {
          result[j] = e;
          return;
        } else if (e.contains(result[j])) {
          console.log("skip: ", e, result[j]);
          return;
        }
      }
      result.push(e);
    }
  });

  return result;
}

function getRealRect(elm) {
  if (elm.childElementCount === 0) {
    var r = elm.getClientRects();
    if (r.length === 3) {
      // for a clipped A tag
      return r[1];
    } else if (r.length === 2) {
      // for a wrapped A tag
      return r[0];
    } else {
      return elm.getBoundingClientRect();
    }
  } else if (elm.childElementCount === 1 && elm.firstElementChild.textContent) {
    var r = elm.firstElementChild.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      r = elm.getBoundingClientRect();
    }
    return r;
  } else {
    return elm.getBoundingClientRect();
  }
}

function isExplicitlyRequested(element) {
  return (
    runtime.conf.clickableSelector &&
    element.matches(runtime.conf.clickableSelector)
  );
}

function filterOverlapElements(elements) {
  // filter out tiny elements
  elements = elements.filter(function (e) {
    var be = getRealRect(e);
    if (e.disabled || e.readOnly || !isElementDrawn(e, be)) {
      return false;
    } else if (
      e.matches("input, textarea, select, form") ||
      e.contentEditable === "true"
    ) {
      return true;
    } else {
      var el = document.elementFromPoint(
        be.left + be.width / 2,
        be.top + be.height / 2
      );
      return (
        !el ||
        (el.shadowRoot && el.childElementCount === 0) ||
        el.contains(e) ||
        e.contains(el)
      );
    }
  });

  return filterAncestors(elements);
}

function getTextNodes(root, pattern, flag) {
  var skip_tags = ["script", "style", "noscript", "surfingkeys_mark"];
  var treeWalker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        if (
          !node.data.trim() ||
          !node.parentNode.offsetParent ||
          skip_tags.indexOf(node.parentNode.localName.toLowerCase()) !== -1 ||
          !pattern.test(node.data)
        ) {
          // node changed, reset pattern.lastIndex
          pattern.lastIndex = 0;
          return NodeFilter.FILTER_REJECT;
        }
        var br = node.parentNode.getBoundingClientRect();
        if (br.width < 4 || br.height < 4) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  var nodes = [];
  if (flag === 1) {
    nodes.push(treeWalker.firstChild());
  } else if (flag === -1) {
    nodes.push(treeWalker.lastChild());
  } else if (flag === 0) {
    return treeWalker;
  } else if (flag === 2) {
    while (treeWalker.nextNode()) nodes.push(treeWalker.currentNode.parentNode);
  } else {
    while (treeWalker.nextNode()) nodes.push(treeWalker.currentNode);
  }
  return nodes;
}

function getTextNodePos(node, offset, length) {
  var selection = document.getSelection();
  selection.setBaseAndExtent(
    node,
    offset,
    node,
    length ? offset + length : node.data.length
  );
  var br = selection.getRangeAt(0).getClientRects()[0];
  var pos = {
    left: -1,
    top: -1,
  };
  if (br && br.height > 0 && br.width > 0) {
    pos.left = br.left;
    pos.top = br.top;
    pos.width = br.width;
    pos.height = br.height;
  }
  return pos;
}

var _focusedRange = document.createRange();
function getTextRect() {
  try {
    _focusedRange.setStart(arguments[0], arguments[1]);
    if (arguments.length > 3) {
      _focusedRange.setEnd(arguments[2], arguments[3]);
    } else if (arguments.length > 2) {
      _focusedRange.setEnd(arguments[0], arguments[2]);
    } else {
      _focusedRange.setEnd(arguments[0], arguments[1]);
    }
  } catch (e) {
    return null;
  }
  return _focusedRange.getBoundingClientRect();
}

function getNearestWord(text, offset) {
  var ret = [0, text.length];
  var nonWord =
    /[^A-Za-z\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/;
  if (offset < 0) {
    offset = 0;
  } else if (offset >= text.length) {
    offset = text.length - 1;
  }
  var found = true;
  if (nonWord.test(text[offset])) {
    var delta = 0;
    found = false;
    while (!found && (offset > delta || offset + delta < text.length)) {
      delta++;
      found =
        (offset - delta >= 0 && !nonWord.test(text[offset - delta])) ||
        (offset + delta < text.length && !nonWord.test(text[offset + delta]));
    }
    offset =
      offset - delta >= 0 && !nonWord.test(text[offset - delta])
        ? offset - delta
        : offset + delta;
  }
  if (found) {
    var start = offset,
      end = offset;
    while (start >= 0 && !nonWord.test(text[start])) {
      start--;
    }
    while (end < text.length && !nonWord.test(text[end])) {
      end++;
    }
    ret = [start + 1, end - start - 1];
  }
  return ret;
}

DOMRect.prototype.has = function (x, y, ex, ey) {
  // allow some errors of x and y as ex and ey respectively.
  return (
    y > this.top - ey &&
    y < this.bottom + ey &&
    x > this.left - ex &&
    x < this.right + ex
  );
};

function initL10n(cb) {
  var lang = runtime.conf.language || window.navigator.language;
  if (lang === "en-US") {
    cb(function (str) {
      return str;
    });
  } else {
    fetch(chrome.extension.getURL("pages/l10n.json"))
      .then(function (res) {
        return res.json();
      })
      .then(function (l10n) {
        if (typeof l10n[lang] === "object") {
          l10n = l10n[lang];
          cb(function (str) {
            return l10n[str] ? l10n[str] : str;
          });
        } else {
          cb(function (str) {
            return str;
          });
        }
      });
  }
}

String.prototype.format = function () {
  var formatted = this;
  for (var i = 0; i < arguments.length; i++) {
    var regexp = new RegExp("\\{" + i + "\\}", "gi");
    formatted = formatted.replace(regexp, arguments[i]);
  }
  return formatted;
};

String.prototype.reverse = function () {
  return this.split("").reverse().join("");
};

RegExp.prototype.toJSON = function () {
  return { source: this.source, flags: this.flags };
};

if (!Array.prototype.flatMap) {
  Array.prototype.flatMap = function (lambda) {
    return Array.prototype.concat.apply([], this.map(lambda));
  };
}

function _parseAnnotation(ag) {
  var annotations = ag.annotation.match(/#(\d+)(.*)/);
  if (annotations !== null) {
    ag.feature_group = parseInt(annotations[1]);
    ag.annotation = annotations[2];
  }
  return ag;
}

function _map(mode, nks, oks) {
  oks = KeyboardUtils.encodeKeystroke(oks);
  var old_map = mode.mappings.find(oks);
  if (old_map) {
    nks = KeyboardUtils.encodeKeystroke(nks);
    mode.mappings.remove(nks);
    // meta.word need to be new
    var meta = Object.assign({}, old_map.meta);
    mode.mappings.add(nks, meta);
    if (!isInUIFrame()) {
      Front.addMapkey(mode.name, nks, oks);
    }
  }
  return old_map;
}

function RUNTIME(action, args, callback) {
  var actionsRepeatBackground = [
    "closeTab",
    "nextTab",
    "previousTab",
    "moveTab",
    "reloadTab",
    "setZoom",
    "closeTabLeft",
    "closeTabRight",
    "focusTabByIndex",
  ];
  (args = args || {}).action = action;
  if (actionsRepeatBackground.indexOf(action) !== -1) {
    // if the action can only be repeated in background, pass repeats to background with args,
    // and set RUNTIME.repeats 1, so that it won't be repeated in foreground's _handleMapKey
    args.repeats = RUNTIME.repeats;
    RUNTIME.repeats = 1;
  }
  try {
    args.needResponse = callback !== undefined;
    chrome.runtime.sendMessage(args, callback);
    if (action === "read") {
      runtime.on("onTtsEvent", callback);
    }
  } catch (e) {
    Front.showPopup("[runtime exception] " + e);
  }
}

function getAnnotations(mappings) {
  return mappings
    .getWords()
    .map(function (w) {
      var meta = mappings.find(w).meta;
      return {
        word: w,
        feature_group: meta.feature_group,
        annotation: meta.annotation,
      };
    })
    .filter(function (m) {
      return m.annotation && m.annotation.length > 0;
    });
}

function constructSearchURL(se, word) {
  if (se.indexOf("{0}") > 0) {
    return se.format(word);
  } else {
    return se + word;
  }
}

function tabOpenLink(str, simultaneousness) {
  simultaneousness = simultaneousness || 5;

  var urls;
  if (str.constructor.name === "Array") {
    urls = str;
  } else if (str instanceof NodeList) {
    urls = Array.from(str).map(function (n) {
      return n.href;
    });
  } else {
    urls = str.trim().split("\n");
  }

  urls = urls
    .map(function (u) {
      return u.trim();
    })
    .filter(function (u) {
      return u.length > 0;
    });
  // open the first batch links immediately
  urls.slice(0, simultaneousness).forEach(function (url) {
    RUNTIME("openLink", {
      tab: {
        tabbed: true,
      },
      url: url,
    });
  });
  // queue the left for later opening when there is one tab closed.
  if (urls.length > simultaneousness) {
    RUNTIME("queueURLs", {
      urls: urls.slice(simultaneousness),
    });
  }
}
////////////////////////////////////////////////////////////////////////////////

function getElements(selectorString) {
  return listElements(document.body, NodeFilter.SHOW_ELEMENT, function (n) {
    return n.offsetHeight && n.offsetWidth && n.matches(selectorString);
  });
}

function getClickableElements(selectorString, pattern) {
  var nodes = listElements(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    function (n) {
      return (
        n.offsetHeight &&
        n.offsetWidth &&
        getComputedStyle(n).cursor === "pointer" &&
        (n.matches(selectorString) ||
          (pattern &&
            (pattern.test(n.textContent) ||
              pattern.test(n.getAttribute("aria-label")))))
      );
    }
  );
  return filterOverlapElements(nodes);
}

function filterInvisibleElements(nodes) {
  return nodes.filter(function (n) {
    return (
      n.offsetHeight &&
      n.offsetWidth &&
      !n.getAttribute("disabled") &&
      isElementPartiallyInViewport(n) &&
      getComputedStyle(n).visibility !== "hidden"
    );
  });
}

function setSanitizedContent(elm, str) {
  elm.innerHTML = DOMPurify.sanitize(str);
}

function createElementWithContent(tag, content, attributes) {
  var elm = document.createElement(tag);
  if (content) {
    setSanitizedContent(elm, content);
  }

  if (attributes) {
    for (var attr in attributes) {
      elm.setAttribute(attr, attributes[attr]);
    }
  }

  return elm;
}

function hasScroll(el, direction, barSize) {
  var offset =
    direction === "y" ? ["scrollTop", "height"] : ["scrollLeft", "width"];
  var result = el[offset[0]];

  if (result < barSize) {
    // set scroll offset to barSize, and verify if we can get scroll offset as barSize
    var originOffset = el[offset[0]];
    el[offset[0]] = el.getBoundingClientRect()[offset[1]];
    result = el[offset[0]];
    if (result !== originOffset) {
      // this is valid for some site such as http://mail.live.com/
      Mode.suppressNextScrollEvent();
    }
    el[offset[0]] = originOffset;
  }
  return result >= barSize;
}

function isEmptyObject(obj) {
  for (var name in obj) {
    return false;
  }
  return true;
}

var _divForHtmlEncoder = document.createElement("div");
function htmlEncode(str) {
  _divForHtmlEncoder.innerText = str;
  return _divForHtmlEncoder.innerHTML;
}

HTMLElement.prototype.one = function (evt, handler) {
  function _onceHandler() {
    handler.call(this);
    this.removeEventListener(evt, _onceHandler);
  }
  this.addEventListener(evt, _onceHandler);
};

HTMLElement.prototype.show = function () {
  this.style.display = "";
};

HTMLElement.prototype.hide = function () {
  this.style.display = "none";
};

HTMLElement.prototype.removeAttributes = function () {
  while (this.attributes.length > 0) {
    this.removeAttribute(this.attributes[0].name);
  }
};
NodeList.prototype.remove = function () {
  this.forEach(function (node) {
    node.remove();
  });
};
NodeList.prototype.show = function () {
  this.forEach(function (node) {
    node.show();
  });
};
NodeList.prototype.hide = function () {
  this.forEach(function (node) {
    node.hide();
  });
};
