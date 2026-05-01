"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type SectionErrorBoundaryProps = {
  children: ReactNode;
  fallbackDescription?: string;
  fallbackTitle: string;
};

type SectionErrorBoundaryState = {
  hasError: boolean;
};

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  override state: SectionErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Detailbereich konnte nicht gerendert werden:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
            Bereich uebersprungen
          </p>
          <h3 className="mt-2 text-lg font-semibold">{this.props.fallbackTitle}</h3>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-100/90">
            {this.props.fallbackDescription ?? "Dieser Bereich konnte nicht geladen werden."}
          </p>
        </section>
      );
    }

    return this.props.children;
  }
}
