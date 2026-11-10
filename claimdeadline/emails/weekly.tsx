import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type WeeklyPick = {
  name: string;
  href: string;
  deadlineLabel: string;
  payout: string;
};

export type WeeklyEmailProps = {
  picks: WeeklyPick[];
  sponsorName?: string | null;
  sponsorHref?: string | null;
  siteUrl: string;
};

export default function WeeklyEmail({
  picks,
  sponsorName,
  sponsorHref,
  siteUrl,
}: WeeklyEmailProps) {
  const preview = picks[0]
    ? `Soonest: ${picks[0].name} closes ${picks[0].deadlineLabel}`
    : "This week's claim deadlines";
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#efe4cf", margin: 0, fontFamily: "Georgia, serif", color: "#1b140e" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "28px 20px" }}>
          <Text style={{ fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
            Monday deadline alert
          </Text>
          <Heading style={{ fontSize: "32px", lineHeight: "1", fontWeight: 560, margin: "0 0 12px" }}>
            ClaimDeadline
          </Heading>
          <Text style={{ fontSize: "15px", lineHeight: "1.45", margin: "0 0 18px" }}>
            Five open US class actions, soonest claim deadline first. Filing is free on the official site.
          </Text>
          <Section>
            {picks.map((pick) => (
              <Text key={pick.href} style={{ fontSize: "15px", lineHeight: "1.4", margin: "0 0 10px" }}>
                <Link href={pick.href} style={{ color: "#1b140e" }}>
                  {pick.name}
                </Link>
                {" — "}
                {pick.payout}
                {" — "}
                {pick.deadlineLabel}
              </Text>
            ))}
          </Section>
          <Hr style={{ borderColor: "#1b140e", margin: "18px 0" }} />
          <Text style={{ fontSize: "14px", margin: "0 0 8px" }}>
            Sponsored by{" "}
            {sponsorName && sponsorHref ? (
              <Link href={sponsorHref} style={{ color: "#c43218" }}>
                {sponsorName}
              </Link>
            ) : (
              "— this week is open"
            )}
          </Text>
          <Text style={{ fontSize: "13px", margin: 0 }}>
            <Link href={siteUrl} style={{ color: "#1b140e" }}>
              See every open deadline
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

WeeklyEmail.PreviewProps = {
  siteUrl: "https://claimdeadline.example",
  sponsorName: "Example sponsor",
  sponsorHref: "https://claimdeadline.example/go/example-sponsor",
  picks: [
    {
      name: "Example settlement",
      href: "https://claimdeadline.example/settlement/example",
      deadlineLabel: "Nov 16",
      payout: "Up to $10",
    },
  ],
} satisfies WeeklyEmailProps;
