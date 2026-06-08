const revealTargets = document.querySelectorAll(
  ".section-heading, .topic-card, .article-card, .metrics-copy, .metric-item, .about-image, .about-copy, .method-lanes article, .contact-copy, .contact-image"
);

revealTargets.forEach((target, index) => {
  target.classList.add("reveal");
  target.style.setProperty("--delay", `${Math.min(index % 6, 5) * 70}ms`);
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14 }
);

revealTargets.forEach((target) => revealObserver.observe(target));

const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
const watchedSections = Array.from(document.querySelectorAll(".section-watch"));
const backToTop = document.querySelector(".back-to-top");
const cursorGlow = document.querySelector(".cursor-glow");
const metricNumbers = document.querySelectorAll(".metric-item strong[data-count]");
const exchangeDialog = document.querySelector(".exchange-dialog");
const exchangeForm = document.querySelector(".exchange-form");
const exchangeStatus = document.querySelector(".exchange-status");
const openExchangeButton = document.querySelector("[data-open-exchange]");
const closeExchangeButton = document.querySelector("[data-close-exchange]");
const supabaseUrl = "https://dcvdsqlhkzukqiqgfwls.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdmRzcWxoa3p1a3FpcWdmd2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTIxOTksImV4cCI6MjA5NjIyODE5OX0.ZGwC-VcGFcbj3CdtmeCR2veotxbHDFkOe-gO1o456_I";
const siteContentUrl = new URL("site-content.json", window.location.href);
let metricsStarted = false;

const setActiveNav = (id) => {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("is-active", isActive);
  });
};

const sectionObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible) {
      setActiveNav(visible.target.id);
    }
  },
  {
    rootMargin: "-18% 0px -55% 0px",
    threshold: [0.12, 0.24, 0.42],
  }
);

watchedSections.forEach((section) => {
  if (section.id) {
    sectionObserver.observe(section);
  }
});

const formatMetric = (value) => {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return `${value}`;
};

const setText = (selector, value) => {
  const element = document.querySelector(selector);

  if (element && value !== undefined && value !== null) {
    element.textContent = value;
  }
};

const setHtmlLines = (selector, value) => {
  const element = document.querySelector(selector);

  if (!element || value === undefined || value === null) {
    return;
  }

  const lines = Array.isArray(value) ? value : String(value).split("\n");
  element.replaceChildren();
  lines.forEach((line, index) => {
    if (index > 0) {
      element.append(document.createElement("br"));
    }

    element.append(document.createTextNode(line));
  });
};

const setLink = (element, data) => {
  if (!element || !data) {
    return;
  }

  if (data.label !== undefined) {
    element.textContent = data.label;
  }

  if (data.href !== undefined) {
    element.setAttribute("href", data.href);
  }
};

const renderHomepageContent = (content) => {
  if (!content || typeof content !== "object") {
    return;
  }

  if (content.meta?.title) {
    document.title = content.meta.title;
  }

  const description = document.querySelector('meta[name="description"]');
  if (description && content.meta?.description) {
    description.setAttribute("content", content.meta.description);
  }

  const brandParts = document.querySelectorAll(".brand span");
  if (brandParts[0] && content.brand?.name) {
    brandParts[0].textContent = content.brand.name;
  }
  if (brandParts[1] && content.brand?.role) {
    brandParts[1].textContent = content.brand.role;
  }

  document.querySelectorAll(".site-nav a").forEach((link, index) => {
    setLink(link, content.navigation?.[index]);
  });

  setText(".hero .eyebrow", content.hero?.eyebrow);
  setHtmlLines("#hero-title", content.hero?.title);
  setText(".hero-lede", content.hero?.lede);
  document.querySelectorAll(".hero-actions a").forEach((link, index) => {
    setLink(link, content.hero?.actions?.[index]);
  });
  document.querySelectorAll(".hero-signals span").forEach((item, index) => {
    const signal = content.hero?.signals?.[index];

    if (signal) {
      item.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = signal.value || "";
      item.append(strong, document.createTextNode(` ${signal.label || ""}`));
    }
  });

  setText(".topics-section .section-heading .eyebrow", content.topicsSection?.eyebrow);
  setText("#topics-title", content.topicsSection?.title);
  setText(".topics-section .section-heading p:last-child", content.topicsSection?.body);
  document.querySelectorAll(".topic-card").forEach((card, index) => {
    const topic = content.topics?.[index];

    if (topic) {
      setTextFrom(card, ".topic-index", topic.index);
      setTextFrom(card, "h3", topic.title);
      setTextFrom(card, "p", topic.body);
    }
  });

  setText(".writing-section .section-heading .eyebrow", content.writingSection?.eyebrow);
  setText("#writing-title", content.writingSection?.title);
  setText(".writing-section .split-heading > p", content.writingSection?.body);
  document.querySelectorAll(".article-card").forEach((card, index) => {
    const article = content.articles?.[index];
    const link = card.querySelector("a");
    const image = card.querySelector("img");

    if (article) {
      if (link && article.href) {
        link.setAttribute("href", article.href);
      }
      if (image && article.image) {
        image.setAttribute("src", article.image);
      }
      if (image && article.alt) {
        image.setAttribute("alt", article.alt);
      }
      setTextFrom(card, ".article-meta", article.meta);
      setTextFrom(card, "h3", article.title);
      setTextFrom(card, ".article-body p:not(.article-meta)", article.body);
      setTextFrom(card, ".read-state", article.state);
    }
  });

  setText(".metrics-copy .eyebrow", content.metricsSection?.eyebrow);
  setText("#metrics-title", content.metricsSection?.title);
  document.querySelectorAll(".metric-item").forEach((item, index) => {
    const metric = content.metrics?.[index];
    const number = item.querySelector("strong[data-count]");
    const label = item.querySelector("span");

    if (metric && number) {
      number.dataset.count = String(metric.value || 0);
      number.textContent = metricsStarted ? formatMetric(Number(metric.value || 0)) : "0";
    }
    if (metric && label) {
      label.textContent = metric.label || "";
    }
  });

  setText(".about-copy .eyebrow", content.about?.eyebrow);
  setText("#about-title", content.about?.title);
  document.querySelectorAll(".about-copy > p:not(.eyebrow)").forEach((paragraph, index) => {
    const value = content.about?.paragraphs?.[index];

    if (value) {
      paragraph.textContent = value;
    }
  });
  document.querySelectorAll(".about-list span").forEach((item, index) => {
    const value = content.about?.tags?.[index];

    if (value) {
      item.textContent = value;
    }
  });

  setText(".method-section .section-heading .eyebrow", content.methodSection?.eyebrow);
  setText("#method-title", content.methodSection?.title);
  setText(".method-section .section-heading p:last-child", content.methodSection?.body);
  document.querySelectorAll(".method-lanes article").forEach((item, index) => {
    const method = content.methods?.[index];

    if (method) {
      setTextFrom(item, "span", method.label);
      setTextFrom(item, "h3", method.title);
      setTextFrom(item, "p", method.body);
    }
  });

  setText(".contact-copy .eyebrow", content.contact?.eyebrow);
  setText("#contact-title", content.contact?.title);
  setText(".contact-copy > p:not(.eyebrow)", content.contact?.body);
  document.querySelectorAll(".contact-links a").forEach((link, index) => {
    setLink(link, content.contact?.links?.[index]);
  });
  setText(".contact-action", content.contact?.buttonLabel);

  setText(".exchange-dialog .eyebrow", content.exchange?.eyebrow);
  setText("#exchange-title", content.exchange?.title);
  setText(".exchange-note", content.exchange?.note);

  setText(".site-footer p", content.footer?.copyright);
  setText(".site-footer a", content.footer?.backToTop);
  setText(".back-to-top", content.footer?.backToTopIcon);
};

const setTextFrom = (root, selector, value) => {
  const element = root.querySelector(selector);

  if (element && value !== undefined && value !== null) {
    element.textContent = value;
  }
};

const loadHomepageContent = async () => {
  try {
    const response = await fetch(siteContentUrl, { cache: "no-cache" });

    if (!response.ok) {
      return;
    }

    const content = await response.json();
    renderHomepageContent(content);
  } catch (error) {
    console.warn("站点内容配置读取失败，继续使用 HTML 默认内容。", error);
  }
};

loadHomepageContent();

const animateMetric = (element) => {
  const target = Number(element.dataset.count);
  const duration = 1200;
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);

    element.textContent = formatMetric(value);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = formatMetric(target);
    }
  };

  requestAnimationFrame(step);
};

const metricsObserver = new IntersectionObserver(
  (entries) => {
    if (metricsStarted) {
      return;
    }

    if (entries.some((entry) => entry.isIntersecting)) {
      metricsStarted = true;
      metricNumbers.forEach(animateMetric);
    }
  },
  { threshold: 0.32 }
);

const metricsSection = document.querySelector(".metrics-section");

if (metricsSection) {
  metricsObserver.observe(metricsSection);
}

const updateBackToTop = () => {
  backToTop?.classList.toggle("is-visible", window.scrollY > 620);
};

window.addEventListener("scroll", updateBackToTop, { passive: true });
updateBackToTop();

window.addEventListener(
  "mousemove",
  (event) => {
    if (!cursorGlow) {
      return;
    }

    document.documentElement.style.setProperty("--glow-x", `${event.clientX}px`);
    document.documentElement.style.setProperty("--glow-y", `${event.clientY}px`);
  },
  { passive: true }
);

openExchangeButton?.addEventListener("click", () => {
  exchangeDialog?.showModal();
});

closeExchangeButton?.addEventListener("click", () => {
  exchangeDialog?.close();
});

exchangeDialog?.addEventListener("click", (event) => {
  if (event.target === exchangeDialog) {
    exchangeDialog.close();
  }
});

exchangeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(exchangeForm);
  const name = String(formData.get("name") || "未填写");
  const wechat = String(formData.get("wechat") || "").trim();
  const topic = String(formData.get("topic") || "学习交流");
  const message = String(formData.get("message") || "未填写");
  const submitButton = exchangeForm.querySelector('button[type="submit"]');

  if (!wechat) {
    exchangeStatus.textContent = "请先填写微信号，方便继续交流。";
    return;
  }

  submitButton.disabled = true;
  exchangeStatus.textContent = "正在提交登记信息...";

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/information_registrations`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        phone: wechat,
        interest: topic,
        message,
        consent: true,
        source_page: window.location.pathname || "/",
        metadata: {
          contact_channel: "wechat",
          user_agent: navigator.userAgent,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`提交失败：${response.status} ${errorText}`);
    }

    exchangeForm.reset();
    exchangeStatus.textContent = "已收到你的登记信息，我会尽快联系你。";
  } catch (error) {
    console.error(error);
    exchangeStatus.textContent = "暂时无法提交，请稍后再试，或刷新页面后重新提交。";
  } finally {
    submitButton.disabled = false;
  }
});
