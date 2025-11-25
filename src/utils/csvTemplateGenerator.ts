/**
 * Generate a CSV template for contact import
 * @returns CSV string with sample data
 */
export const generateContactsCSVTemplate = (): string => {
  const headers = ["nome", "telefone"];
  const sampleData = [
    ["João Silva", "5511999999999"],
    ["Maria Santos", "5521988888888"],
    ["Pedro Oliveira", "5511977777777"],
  ];

  const csvContent = [
    headers.join(","),
    ...sampleData.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
};

/**
 * Download CSV template
 */
export const downloadContactsCSVTemplate = () => {
  const csvContent = generateContactsCSVTemplate();
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", "template_contatos.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Validate CSV structure
 * @param file - CSV file to validate
 * @returns Promise with validation result
 */
export const validateCSVStructure = async (
  file: File
): Promise<{ isValid: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        resolve({ isValid: false, error: "Arquivo vazio" });
        return;
      }

      const lines = content.split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        resolve({
          isValid: false,
          error: "Arquivo deve conter cabeçalho e pelo menos uma linha de dados",
        });
        return;
      }

      const headers = lines[0].toLowerCase().split(",");
      const hasName = headers.some((h) => h.includes("nome") || h.includes("name"));
      const hasPhone = headers.some(
        (h) => h.includes("telefone") || h.includes("phone") || h.includes("tel")
      );

      if (!hasName || !hasPhone) {
        resolve({
          isValid: false,
          error: 'Arquivo deve conter colunas "nome" e "telefone"',
        });
        return;
      }

      resolve({ isValid: true });
    };

    reader.onerror = () => {
      resolve({ isValid: false, error: "Erro ao ler arquivo" });
    };

    reader.readAsText(file);
  });
};
