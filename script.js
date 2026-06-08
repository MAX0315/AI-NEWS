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
