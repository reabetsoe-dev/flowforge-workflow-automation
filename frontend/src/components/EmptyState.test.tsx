import { render, screen } from "@testing-library/react";
import { FileSearch } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders a clear title and message", () => {
    render(
      <EmptyState
        icon={FileSearch}
        title="No audit logs found"
        message="Adjust filters or generate more workflow activity."
      />,
    );

    expect(screen.getByText("No audit logs found")).toBeInTheDocument();
    expect(screen.getByText("Adjust filters or generate more workflow activity.")).toBeInTheDocument();
  });
});
