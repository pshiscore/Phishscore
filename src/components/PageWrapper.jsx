export default function PageWrapper({ children }) {
  return (
    <div style={{
      width: "100%",
      maxWidth: 1200,
      margin: "0 auto",
      padding: "0 16px",
      boxSizing: "border-box",
      minWidth: 0,
    }}>
      {children}
    </div>
  );
}
