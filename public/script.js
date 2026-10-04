/**
 * MEOW AI AGENT — site scripts
 * Organized as small, independent modules, each with a single job.
 * Every module guards for the elements it needs and no-ops if they're absent,
 * so sections can be added/removed without breaking the rest.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------
   * Toast — shared tiny notification used by the forms below
   * --------------------------------------------------------- */
  var Toast = (function () {
    var el = document.getElementById("toast");
    var timer = null;
    function show(message) {
      if (!el) return;
      el.textContent = message;
      el.classList.add("show");
      clearTimeout(timer);
      timer = setTimeout(function () { el.classList.remove("show"); }, 2600);
    }
    return { show: show };
  })();

  /* ---------------------------------------------------------
   * ThemeToggle — light/dark, in-memory only (no persistence)
   * --------------------------------------------------------- */
  var ThemeToggle = (function () {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    var root = document.documentElement;
    var sunIcon = btn.querySelector(".icon-sun");
    var moonIcon = btn.querySelector(".icon-moon");

    function setTheme(theme) {
      if (theme === "dark") {
        root.setAttribute("data-theme", "dark");
        btn.setAttribute("aria-pressed", "true");
        btn.setAttribute("aria-label", "Switch to light theme");
        sunIcon.classList.add("is-hidden");
        moonIcon.classList.remove("is-hidden");
      } else {
        root.removeAttribute("data-theme");
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", "Switch to dark theme");
        sunIcon.classList.remove("is-hidden");
        moonIcon.classList.add("is-hidden");
      }
    }

    btn.addEventListener("click", function () {
      var isDark = root.getAttribute("data-theme") === "dark";
      setTheme(isDark ? "light" : "dark");
    });
  })();

  /* ---------------------------------------------------------
   * MobileNav — hamburger toggle for the nav-links list
   * --------------------------------------------------------- */
  var MobileNav = (function () {
    var toggle = document.getElementById("menuToggle");
    var links = document.getElementById("navLinks");
    if (!toggle || !links) return;

    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    links.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  })();

  /* ---------------------------------------------------------
   * ScrollProgress — thin bar across the top tracking scroll %
   * --------------------------------------------------------- */
  var ScrollProgress = (function () {
    var fill = document.getElementById("progressFill");
    if (!fill) return;
    var ticking = false;

    function update() {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      fill.style.width = pct + "%";
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  })();

  /* ---------------------------------------------------------
   * ScrollSpy — highlights the nav link for the visible section
   * --------------------------------------------------------- */
  var ScrollSpy = (function () {
    var navLinks = document.querySelectorAll(".nav-links a[data-nav]");
    if (!navLinks.length || !("IntersectionObserver" in window)) return;

    var sections = [];
    navLinks.forEach(function (link) {
      var id = link.getAttribute("data-nav");
      var section = document.getElementById(id);
      if (section) sections.push({ link: link, section: section });
    });

    function setActive(id) {
      navLinks.forEach(function (link) {
        link.classList.toggle("active", link.getAttribute("data-nav") === id);
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: "-40% 0px -50% 0px", threshold: 0 });

    sections.forEach(function (item) { observer.observe(item.section); });
  })();

  /* ---------------------------------------------------------
   * RevealOnScroll — fades/slides in [data-reveal] elements once
   * --------------------------------------------------------- */
  var RevealOnScroll = (function () {
    var items = document.querySelectorAll("[data-reveal]");
    // Elements are visible by default (see stylesheet). Only switch on the
    // hide-then-reveal behavior once we know we can actually observe and
    // reveal them — otherwise leave everything as plainly visible.
    if (!items.length || !("IntersectionObserver" in window)) return;

    document.documentElement.classList.add("reveal-ready");

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    items.forEach(function (el) { observer.observe(el); });

    // Safety net: if something below the fold never crosses the
    // intersection threshold (e.g. a very short page, a headless
    // renderer that skips scroll events), reveal the rest after the
    // page has settled rather than leaving it invisible forever.
    window.addEventListener("load", function () {
      setTimeout(function () {
        document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach(function (el) {
          var rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add("is-visible");
          }
        });
      }, 1200);
    });
  })();

  /* ---------------------------------------------------------
   * StatCounters — counts stat numbers up when they scroll in
   * --------------------------------------------------------- */
  var StatCounters = (function () {
    var stats = document.querySelectorAll(".stat-num[data-count]");
    if (!stats.length) return;

    function animate(el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-suffix") || "";
      var duration = 900;
      var start = null;

      function step(ts) {
        if (start === null) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var value = Math.round(target * eased);
        el.textContent = value.toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) {
      stats.forEach(animate);
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    stats.forEach(function (el) { observer.observe(el); });
  })();

  /* ---------------------------------------------------------
   * BackToTop — floating button, appears after scrolling down
   * --------------------------------------------------------- */
  var BackToTop = (function () {
    var btn = document.getElementById("backToTop");
    if (!btn) return;

    window.addEventListener("scroll", function () {
      btn.classList.toggle("show", window.scrollY > 480);
    }, { passive: true });

    btn.hidden = false;
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  })();

  /* ---------------------------------------------------------
   * AuthModal — Sign In / Sign Up dialog, shared by every
   * button with a [data-auth="signin"|"signup"] attribute
   * --------------------------------------------------------- */
  var AuthModal = (function () {
    var overlay = document.getElementById("modalOverlay");
    var modalTitle = document.getElementById("modalTitle");
    var modalSwitch = document.getElementById("modalSwitch");
    var modalSwitchText = document.getElementById("modalSwitchText");
    var modalClose = document.getElementById("modalClose");
    var form = document.getElementById("authForm");
    if (!overlay || !form) return;

    var lastFocused = null;
    var mode = "signin";

    var copy = {
      signin: { title: "Sign In", lead: "New here? ", action: "Create an account" },
      signup: { title: "Sign Up", lead: "Already have an account? ", action: "Sign in" }
    };

    function render() {
      var c = copy[mode];
      modalTitle.textContent = c.title;
      modalSwitchText.textContent = c.lead;
      modalSwitchText.appendChild(modalSwitch);
      modalSwitch.textContent = c.action;
      Validation.clearAll(form);
    }

    function open(requestedMode) {
      mode = requestedMode === "signup" ? "signup" : "signin";
      render();
      lastFocused = document.activeElement;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      var firstInput = form.querySelector("input");
      if (firstInput) firstInput.focus();
      document.addEventListener("keydown", onKeydown);
    }

    function close() {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      document.removeEventListener("keydown", onKeydown);
      if (lastFocused) lastFocused.focus();
    }

    function onKeydown(e) { if (e.key === "Escape") close(); }

    document.querySelectorAll("[data-auth]").forEach(function (btn) {
      btn.addEventListener("click", function () { open(btn.getAttribute("data-auth")); });
    });

    if (modalClose) modalClose.addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    if (modalSwitch) {
      modalSwitch.addEventListener("click", function () {
        mode = mode === "signin" ? "signup" : "signin";
        render();
        var firstInput = form.querySelector("input");
        if (firstInput) firstInput.focus();
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!Validation.validate(form)) return;
      var verb = mode === "signup" ? "Account created" : "Signed in";
      close();
      form.reset();
      Toast.show(verb + " — welcome to Meow.");
    });
  })();

  /* ---------------------------------------------------------
   * Validation — small shared helper for inline form errors.
   * Looks for a sibling .field-error under each labeled input.
   * --------------------------------------------------------- */
  var Validation = (function () {
    function messageFor(input) {
      if (input.validity.valueMissing) return "This field is required.";
      if (input.validity.typeMismatch && input.type === "email") return "Enter a valid email address.";
      if (input.validity.tooShort) return "Must be at least " + input.minLength + " characters.";
      return "Please check this field.";
    }

    function showError(input) {
      var errorEl = input.parentElement.querySelector(".field-error");
      input.classList.add("invalid");
      if (errorEl) errorEl.textContent = messageFor(input);
    }

    function clearError(input) {
      var errorEl = input.parentElement.querySelector(".field-error");
      input.classList.remove("invalid");
      if (errorEl) errorEl.textContent = "";
    }

    function clearAll(form) {
      form.querySelectorAll("input, textarea").forEach(clearError);
    }

    function validate(form) {
      var valid = true;
      form.querySelectorAll("input[required], textarea[required]").forEach(function (input) {
        if (!input.checkValidity()) {
          showError(input);
          valid = false;
        } else {
          clearError(input);
        }
      });
      return valid;
    }

    function wireLiveClear(form) {
      form.querySelectorAll("input, textarea").forEach(function (input) {
        input.addEventListener("input", function () {
          if (input.classList.contains("invalid") && input.checkValidity()) clearError(input);
        });
      });
    }

    return { validate: validate, clearAll: clearAll, wireLiveClear: wireLiveClear };
  })();

  /* ---------------------------------------------------------
   * ContactForm
   * --------------------------------------------------------- */
  (function ContactForm() {
    var form = document.getElementById("contactForm");
    if (!form) return;
    Validation.wireLiveClear(form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!Validation.validate(form)) return;
      form.reset();
      Validation.clearAll(form);
      Toast.show("Message sent — Meow will reply soon.");
    });
  })();

  /* ---------------------------------------------------------
   * NewsletterForm
   * --------------------------------------------------------- */
  (function NewsletterForm() {
    var form = document.getElementById("newsletterForm");
    if (!form) return;
    var input = document.getElementById("newsletterEmail");
    var errorEl = form.querySelector(".field-error");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!input.checkValidity()) {
        input.classList.add("invalid");
        if (errorEl) errorEl.textContent = "Enter a valid email address.";
        return;
      }
      input.classList.remove("invalid");
      if (errorEl) errorEl.textContent = "";
      form.reset();
      Toast.show("You're on the list.");
    });

    input.addEventListener("input", function () {
      if (input.classList.contains("invalid") && input.checkValidity()) {
        input.classList.remove("invalid");
        if (errorEl) errorEl.textContent = "";
      }
    });
  })();
})();