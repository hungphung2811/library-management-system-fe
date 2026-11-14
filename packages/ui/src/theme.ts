import type { ThemeConfig } from "antd";

/** Giữ đồng bộ với @theme trong tailwind.css (color-brand-600, color-surface, color-ink). */
export const brand = {
  primary: "#4338ca",
  layoutBg: "#f4f5fb",
  text: "#1f2437",
};

export const theme: ThemeConfig = {
  // antd 6 dùng CSS variables mặc định nên không cần bật cssVar.
  token: {
    colorPrimary: brand.primary,
    colorInfo: brand.primary,
    colorSuccess: "#16a34a",
    colorWarning: "#d97706",
    colorError: "#dc2626",
    colorTextBase: brand.text,
    colorBgLayout: brand.layoutBg,
    colorBorderSecondary: "#e8eaf3",
    borderRadius: 10,
    borderRadiusLG: 14,
    controlHeight: 38,
    fontSize: 14,
    fontFamily:
      'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    boxShadowTertiary: "0 1px 2px rgba(31,36,55,.04), 0 4px 16px rgba(31,36,55,.06)",
  },
  components: {
    Button: { fontWeight: 500, primaryShadow: "0 2px 6px rgba(67,56,202,.28)" },
    Card: { headerFontSize: 16 },
    Table: { headerBg: "#f7f8fd", headerColor: "#5b6280", rowHoverBg: "#f7f8fd" },
    Menu: {
      horizontalItemSelectedColor: brand.primary,
      horizontalItemHoverColor: brand.primary,
      itemBg: "transparent",
    },
    Input: { activeShadow: "0 0 0 3px rgba(67,56,202,.15)" },
  },
};
