import type { ThemeConfig } from "antd";

/** Giữ đồng bộ với @theme trong tailwind.css (color-brand-500, color-surface, color-ink, color-line). */
export const brand = {
  primary: "#1b84ff",
  layoutBg: "#ffffff",
  text: "#071437",
  line: "#e5e7ee",
};

export const theme: ThemeConfig = {
  // antd 6 dùng CSS variables mặc định nên không cần bật cssVar.
  token: {
    colorPrimary: brand.primary,
    colorInfo: brand.primary,
    colorSuccess: "#17b26a",
    colorWarning: "#f5a524",
    colorError: "#f04438",
    colorTextBase: brand.text,
    colorTextSecondary: "#636b84",
    colorBgLayout: brand.layoutBg,
    colorBorder: "#dbdfe9",
    colorBorderSecondary: brand.line,
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    controlHeight: 38,
    fontSize: 14,
    fontFamily:
      '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    boxShadowTertiary: "0 1px 2px rgba(0,0,0,.05)",
  },
  components: {
    Button: { fontWeight: 500, primaryShadow: "none", defaultShadow: "none", dangerShadow: "none" },
    Card: { headerFontSize: 15, headerHeight: 56, bodyPadding: 20 },
    Table: {
      headerBg: "#f6f7f9",
      headerColor: "#636b84",
      headerSplitColor: "transparent",
      rowHoverBg: "#fafbfc",
      cellPaddingBlock: 14,
    },
    Input: { activeShadow: "0 0 0 3px rgba(27,132,255,.14)" },
    Tag: { defaultBg: "#f1f2f6", defaultColor: "#4b5675" },
  },
};
