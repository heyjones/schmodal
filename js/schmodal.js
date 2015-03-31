+function ($) {
  'use strict';

  // SCHMODAL CLASS DEFINITION
  // ======================

  var Schmodal = function (element, options) {
    this.options             = options
    this.$body               = $(document.body)
    this.$element            = $(element)
    this.$dialog             = this.$element.find('.schmodal-dialog')
    this.$backdrop           = null
    this.isShown             = null
    this.originalBodyPad     = null
    this.scrollbarWidth      = 0
    this.ignoreBackdropClick = false

    if (this.options.remote) {
      this.$element
        .find('.schmodal-content')
        .load(this.options.remote, $.proxy(function () {
          this.$element.trigger('loaded.bs.schmodal')
        }, this))
    }
  }

  Schmodal.VERSION  = '3.3.2'

  Schmodal.TRANSITION_DURATION = 300
  Schmodal.BACKDROP_TRANSITION_DURATION = 150

  Schmodal.DEFAULTS = {
    backdrop: true,
    keyboard: true,
    show: true
  }

  Schmodal.prototype.toggle = function (_relatedTarget) {
    return this.isShown ? this.hide() : this.show(_relatedTarget)
  }

  Schmodal.prototype.show = function (_relatedTarget) {
    var that = this
    var e    = $.Event('show.bs.schmodal', { relatedTarget: _relatedTarget })

    this.$element.trigger(e)

    if (this.isShown || e.isDefaultPrevented()) return

    this.isShown = true

    this.checkScrollbar()
    this.setScrollbar()
    this.$body.addClass('schmodal-open')

    this.escape()
    this.resize()

    this.$element.on('click.dismiss.bs.schmodal', '[data-dismiss="schmodal"]', $.proxy(this.hide, this))

    this.$dialog.on('mousedown.dismiss.bs.schmodal', function () {
      that.$element.one('mouseup.dismiss.bs.schmodal', function (e) {
        if ($(e.target).is(that.$element)) that.ignoreBackdropClick = true
      })
    })

    this.backdrop(function () {
      var transition = $.support.transition && that.$element.hasClass('fade')

      if (!that.$element.parent().length) {
        that.$element.appendTo(that.$body) // don't move schmodals dom position
      }

      that.$element
        .show()
        .scrollTop(0)

      that.adjustDialog()

      if (transition) {
        that.$element[0].offsetWidth // force reflow
      }

      that.$element
        .addClass('in')
        .attr('aria-hidden', false)

      that.enforceFocus()

      var e = $.Event('shown.bs.schmodal', { relatedTarget: _relatedTarget })

      transition ?
        that.$dialog // wait for schmodal to slide in
          .one('bsTransitionEnd', function () {
            that.$element.trigger('focus').trigger(e)
          })
          .emulateTransitionEnd(Schmodal.TRANSITION_DURATION) :
        that.$element.trigger('focus').trigger(e)
    })
  }

  Schmodal.prototype.hide = function (e) {
    if (e) e.preventDefault()

    e = $.Event('hide.bs.schmodal')

    this.$element.trigger(e)

    if (!this.isShown || e.isDefaultPrevented()) return

    this.isShown = false

    this.escape()
    this.resize()

    $(document).off('focusin.bs.schmodal')

    this.$element
      .removeClass('in')
      .attr('aria-hidden', true)
      .off('click.dismiss.bs.schmodal')
      .off('mouseup.dismiss.bs.schmodal')

    this.$dialog.off('mousedown.dismiss.bs.schmodal')

    $.support.transition && this.$element.hasClass('fade') ?
      this.$element
        .one('bsTransitionEnd', $.proxy(this.hideSchmodal, this))
        .emulateTransitionEnd(Schmodal.TRANSITION_DURATION) :
      this.hideSchmodal()
  }

  Schmodal.prototype.enforceFocus = function () {
    $(document)
      .off('focusin.bs.schmodal') // guard against infinite focus loop
      .on('focusin.bs.schmodal', $.proxy(function (e) {
        if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {
          this.$element.trigger('focus')
        }
      }, this))
  }

  Schmodal.prototype.escape = function () {
    if (this.isShown && this.options.keyboard) {
      this.$element.on('keydown.dismiss.bs.schmodal', $.proxy(function (e) {
        e.which == 27 && this.hide()
      }, this))
    } else if (!this.isShown) {
      this.$element.off('keydown.dismiss.bs.schmodal')
    }
  }

  Schmodal.prototype.resize = function () {
    if (this.isShown) {
      $(window).on('resize.bs.schmodal', $.proxy(this.handleUpdate, this))
    } else {
      $(window).off('resize.bs.schmodal')
    }
  }

  Schmodal.prototype.hideSchmodal = function () {
    var that = this
    this.$element.hide()
    this.backdrop(function () {
      that.$body.removeClass('schmodal-open')
      that.resetAdjustments()
      that.resetScrollbar()
      that.$element.trigger('hidden.bs.schmodal')
    })
  }

  Schmodal.prototype.removeBackdrop = function () {
    this.$backdrop && this.$backdrop.remove()
    this.$backdrop = null
  }

  Schmodal.prototype.backdrop = function (callback) {
    var that = this
    var animate = this.$element.hasClass('fade') ? 'fade' : ''

    if (this.isShown && this.options.backdrop) {
      var doAnimate = $.support.transition && animate

      this.$backdrop = $('<div class="schmodal-backdrop ' + animate + '" />')
        .appendTo(this.$body)

      this.$element.on('click.dismiss.bs.schmodal', $.proxy(function (e) {
        if (this.ignoreBackdropClick) {
          this.ignoreBackdropClick = false
          return
        }
        if (e.target !== e.currentTarget) return
        this.options.backdrop == 'static'
          ? this.$element[0].focus()
          : this.hide()
      }, this))

      if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

      this.$backdrop.addClass('in')

      if (!callback) return

      doAnimate ?
        this.$backdrop
          .one('bsTransitionEnd', callback)
          .emulateTransitionEnd(Schmodal.BACKDROP_TRANSITION_DURATION) :
        callback()

    } else if (!this.isShown && this.$backdrop) {
      this.$backdrop.removeClass('in')

      var callbackRemove = function () {
        that.removeBackdrop()
        callback && callback()
      }
      $.support.transition && this.$element.hasClass('fade') ?
        this.$backdrop
          .one('bsTransitionEnd', callbackRemove)
          .emulateTransitionEnd(Schmodal.BACKDROP_TRANSITION_DURATION) :
        callbackRemove()

    } else if (callback) {
      callback()
    }
  }

  // these following methods are used to handle overflowing schmodals

  Schmodal.prototype.handleUpdate = function () {
    this.adjustDialog()
  }

  Schmodal.prototype.adjustDialog = function () {
    var schmodalIsOverflowing = this.$element[0].scrollHeight > document.documentElement.clientHeight

    this.$element.css({
      paddingLeft:  !this.bodyIsOverflowing && schmodalIsOverflowing ? this.scrollbarWidth : '',
      paddingRight: this.bodyIsOverflowing && !schmodalIsOverflowing ? this.scrollbarWidth : ''
    })
  }

  Schmodal.prototype.resetAdjustments = function () {
    this.$element.css({
      paddingLeft: '',
      paddingRight: ''
    })
  }

  Schmodal.prototype.checkScrollbar = function () {
    var fullWindowWidth = window.innerWidth
    if (!fullWindowWidth) { // workaround for missing window.innerWidth in IE8
      var documentElementRect = document.documentElement.getBoundingClientRect()
      fullWindowWidth = documentElementRect.right - Math.abs(documentElementRect.left)
    }
    this.bodyIsOverflowing = document.body.clientWidth < fullWindowWidth
    this.scrollbarWidth = this.measureScrollbar()
  }

  Schmodal.prototype.setScrollbar = function () {
    var bodyPad = parseInt((this.$body.css('padding-right') || 0), 10)
    this.originalBodyPad = document.body.style.paddingRight || ''
    if (this.bodyIsOverflowing) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)
  }

  Schmodal.prototype.resetScrollbar = function () {
    this.$body.css('padding-right', this.originalBodyPad)
  }

  Schmodal.prototype.measureScrollbar = function () { // thx walsh
    var scrollDiv = document.createElement('div')
    scrollDiv.className = 'schmodal-scrollbar-measure'
    this.$body.append(scrollDiv)
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
    this.$body[0].removeChild(scrollDiv)
    return scrollbarWidth
  }


  // SCHMODAL PLUGIN DEFINITION
  // =======================

  function Plugin(option, _relatedTarget) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.schmodal')
      var options = $.extend({}, Schmodal.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data) $this.data('bs.schmodal', (data = new Schmodal(this, options)))
      if (typeof option == 'string') data[option](_relatedTarget)
      else if (options.show) data.show(_relatedTarget)
    })
  }

  var old = $.fn.schmodal

  $.fn.schmodal             = Plugin
  $.fn.schmodal.Constructor = Schmodal


  // SCHMODAL NO CONFLICT
  // =================

  $.fn.schmodal.noConflict = function () {
    $.fn.schmodal = old
    return this
  }


  // SCHMODAL DATA-API
  // ==============

  $(document).on('click.bs.schmodal.data-api', '[data-toggle="schmodal"]', function (e) {
    var $this   = $(this)
    var href    = $this.attr('href')
    var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) // strip for ie7
    var option  = $target.data('bs.schmodal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())

    if ($this.is('a')) e.preventDefault()

    $target.one('show.bs.schmodal', function (showEvent) {
      if (showEvent.isDefaultPrevented()) return // only register focus restorer if schmodal will actually get shown
      $target.one('hidden.bs.schmodal', function () {
        $this.is(':visible') && $this.trigger('focus')
      })
    })
    Plugin.call($target, option, this)
  })

}(jQuery);
