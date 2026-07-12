import { getTranslations, setRequestLocale } from "next-intl/server";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import PlaceholderPhoto from "@/components/PlaceholderPhoto";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tNav = await getTranslations("nav");
  const tHero = await getTranslations("landing.hero");
  const tWind = await getTranslations("landing.windMoment");
  const tFeatures = await getTranslations("landing.features");
  const tSignup = await getTranslations("landing.signup");
  const tFooter = await getTranslations("landing.footer");

  const featureItems = tFeatures.raw("items") as {
    number: string;
    title: string;
    body: string;
    photoAlt: string;
  }[];

  const featurePhotos = [
    "https://source.unsplash.com/1200x900/?bicycle,signpost,netherlands",
    "https://source.unsplash.com/1200x900/?netherlands,town,aerial",
    "https://source.unsplash.com/1200x900/?hills,cycling,road",
    "https://source.unsplash.com/1200x900/?bicycle,gps,cockpit",
  ];

  return (
    <div className="flex flex-col min-h-screen bg-meewind-bg text-meewind-fg">
      <header className="sticky top-0 z-50 border-b border-meewind-border bg-meewind-bg/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="meewind-display text-lg tracking-wide">{tNav("wordmark")}</span>
          <div className="hidden items-center gap-8 text-sm font-medium sm:flex">
            <a href="#wind" className="hover:text-meewind-accent">
              {tNav("linkWind")}
            </a>
            <a href="#features" className="hover:text-meewind-accent">
              {tNav("linkFeatures")}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <Link
              href="/planner"
              className="meewind-clip bg-meewind-accent px-5 py-2 text-sm font-semibold text-meewind-accent-fg"
            >
              {tNav("cta")}
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-meewind-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
            <div>
              <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-meewind-accent">
                {tHero("kicker")}
              </p>
              <h1 className="meewind-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
                {tHero("headline")}
              </h1>
              <p className="mt-6 max-w-md text-base text-meewind-fg-muted">{tHero("sub")}</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/planner"
                  className="meewind-clip bg-meewind-accent px-6 py-3 text-sm font-semibold text-meewind-accent-fg"
                >
                  {tHero("ctaPrimary")}
                </Link>
                <a href="#wind" className="text-sm font-semibold underline underline-offset-4">
                  {tHero("ctaSecondary")}
                </a>
              </div>
            </div>
            <PlaceholderPhoto
              src="https://source.unsplash.com/1200x900/?cycling,dike,netherlands,windmill"
              alt={tHero("photoAlt")}
              className="meewind-clip h-64 w-full md:h-96"
            />
          </div>
        </section>

        {/* Wind moment — standalone centerpiece, right after the hero */}
        <section id="wind" className="relative overflow-hidden border-b border-meewind-border bg-meewind-accent">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 text-meewind-accent-fg md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-4 text-sm font-semibold tracking-[0.2em]">{tWind("kicker")}</p>
              <h2 className="meewind-display text-3xl leading-[1.05] sm:text-4xl md:text-5xl">
                {tWind("headline")}
              </h2>
              <p className="mt-6 max-w-md text-base">{tWind("body")}</p>
              <p className="mt-6 max-w-md rounded-md bg-meewind-accent-fg/10 p-4 text-sm font-medium">
                {tWind("example")}
              </p>
            </div>
            <PlaceholderPhoto
              src="https://source.unsplash.com/1200x900/?coast,wind,zeeland"
              alt={tWind("photoAlt")}
              className="h-64 w-full md:h-96"
            />
          </div>
        </section>

        {/* 01-04 feature grid */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-10 text-sm font-semibold tracking-[0.2em] text-meewind-accent">
            {tFeatures("kicker")}
          </p>
          <div className="flex flex-col">
            {featureItems.map((item, i) => (
              <div
                key={item.number}
                className="grid grid-cols-1 gap-6 border-t border-meewind-border py-10 last:border-b sm:grid-cols-[110px_1fr_240px]"
              >
                <span className="meewind-display text-4xl text-meewind-fg-muted">
                  {item.number}
                </span>
                <div>
                  <h3 className="meewind-display text-xl sm:text-2xl">{item.title}</h3>
                  <p className="mt-3 max-w-lg text-sm text-meewind-fg-muted">{item.body}</p>
                </div>
                <PlaceholderPhoto
                  src={featurePhotos[i]}
                  alt={item.photoAlt}
                  className="h-40 w-full sm:h-full"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Signup / CTA */}
        <section className="border-t border-meewind-border">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="meewind-display text-3xl sm:text-4xl">{tSignup("headline")}</h2>
            <p className="mt-4 text-base text-meewind-fg-muted">{tSignup("body")}</p>
            <Link
              href="/planner"
              className="meewind-clip mt-8 inline-block bg-meewind-accent px-8 py-3 text-sm font-semibold text-meewind-accent-fg"
            >
              {tSignup("cta")}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-meewind-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-10 text-center text-sm text-meewind-fg-muted sm:flex-row sm:justify-between sm:text-left">
          <span className="meewind-display text-base text-meewind-fg">{tNav("wordmark")}</span>
          <p>{tFooter("tagline")}</p>
          <p>{tFooter("domain")}</p>
        </div>
      </footer>
    </div>
  );
}
