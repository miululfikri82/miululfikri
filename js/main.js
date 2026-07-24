/* ==========================
   LOADER
========================== */

window.addEventListener("load", function () {

    const loader = document.getElementById("loader");

    if (loader) {

        loader.classList.add("loader-hidden");

        loader.addEventListener("transitionend", function () {
            loader.style.display = "none";
        });

    }

});

/* ==========================
   COUNTER STATISTIK
========================== */

document.addEventListener("DOMContentLoaded", function () {

    const counters = document.querySelectorAll(".counter-number");

    if (!counters.length) return;

    const animateCounter = (el) => {

        const target = parseInt(el.getAttribute("data-target"), 10) || 0;

        const duration = 1500;

        const start = performance.now();

        function step(now) {

            const progress = Math.min((now - start) / duration, 1);

            el.textContent = Math.floor(progress * target);

            if (progress < 1) {

                requestAnimationFrame(step);

            } else {

                el.textContent = target;

            }

        }

        requestAnimationFrame(step);

    };

    const observer = new IntersectionObserver((entries, obs) => {

        entries.forEach((entry) => {

            if (entry.isIntersecting) {

                animateCounter(entry.target);

                obs.unobserve(entry.target);

            }

        });

    }, { threshold: 0.5 });

    counters.forEach((counter) => observer.observe(counter));

});

/* ==========================
   TESTIMONI SLIDER
========================== */

const testimonialSwiper = new Swiper(".testimonialSwiper", {

    loop: true,

    autoplay: {

        delay: 4000,

        disableOnInteraction: false,

    },

    spaceBetween: 30,

    pagination: {

        el: ".swiper-pagination",

        clickable: true,

    },

    breakpoints: {

        0: {

            slidesPerView: 1

        },

        768: {

            slidesPerView: 2

        },

        1200: {

            slidesPerView: 3

        }

    }

});

/*========================================
BACK TO TOP
========================================*/

const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", function () {

    if (window.scrollY > 300) {

        backToTop.classList.add("show");

    } else {

        backToTop.classList.remove("show");

    }

});

backToTop.addEventListener("click", function () {

    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

});
/*=========================================
DARK MODE
=========================================*/
document.addEventListener("DOMContentLoaded", function () {

    const themeToggle = document.getElementById("themeToggle");

    if (!themeToggle) return;

    const body = document.body;

    // Cek tema tersimpan
    if (localStorage.getItem("theme") === "dark") {

        body.classList.add("dark-mode");

        themeToggle.innerHTML =
            '<i class="bi bi-sun-fill"></i>';

    }

    // Klik tombol
    themeToggle.addEventListener("click", function () {

        body.classList.toggle("dark-mode");

        if (body.classList.contains("dark-mode")) {

            localStorage.setItem("theme", "dark");

            themeToggle.innerHTML =
                '<i class="bi bi-sun-fill"></i>';

        } else {

            localStorage.setItem("theme", "light");

            themeToggle.innerHTML =
                '<i class="bi bi-moon-stars-fill"></i>';

        }

    });

});