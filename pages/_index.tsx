import React from "react";
import { Helmet } from "react-helmet";
import { LandingHero } from "../components/LandingHero";
import { LandingFeatures } from "../components/LandingFeatures";
import { LandingCourses } from "../components/LandingCourses";
import { LandingFooter } from "../components/LandingFooter";
import styles from "./_index.module.css";

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <Helmet>
        <title>MUSE INC - MUSE INC Ho Chi Minh City</title>
        <meta name="description" content="MUSE Inc offers professional DJ training in Ho Chi Minh City. Learn from pro DJs, book studio time, and elevate your sound with specialized courses in HipHop, EDM, and Techno." />
      </Helmet>
      
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingCourses />
      </main>
      
      <LandingFooter />
    </div>
  );
}