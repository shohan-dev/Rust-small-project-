import Link from "next/link";
import Navbar from "../components/Navbar";

export default function HomePage() {
  return (
    <div className="page-with-nav">
      <Navbar />
      <main className="hero">
        <div className="hero-badge">
          <span className="badge badge-accent">✦ WebRTC · Real-Time · Secure</span>
        </div>

        <h1>
          Video rooms for
          <br />
          <span>modern teams</span>
        </h1>

        <p className="hero-sub">
          Create a room in seconds, invite anyone, and collaborate live — with
          crystal-clear video, low-latency audio, and real-time chat built in.
        </p>

        <div className="hero-actions">
          <Link href="/register" className="btn btn-primary btn-lg">
            Start for free →
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            Sign in
          </Link>
        </div>

        <div className="hero-features">
          {[
            "End-to-end encryption",
            "Up to 25 participants",
            "Persistent chat history",
            "Private rooms with access keys",
            "No downloads required",
          ].map((f) => (
            <div className="hero-feature" key={f}>
              <div className="feature-dot" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

