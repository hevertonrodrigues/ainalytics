export const EXTRACT_WEBSITE_INFO_PROMPT = `You are an expert web researcher and data extractor.
I need you to search the internet for the domain "{{DOMAIN}}" and explore its main pages and content.
Based on your research, please extract the following:
1. website_title: The main title of the website or company name.
2. metatags: A summary of the core keywords, description, and meta information you can deduce.
3. extracted_content: A detailed summary of what the company does, their products/services, target audience, and any other relevant public information found on their website.

You must respond with ONLY a valid JSON object matching the following structure exactly, with no markdown fences or other text:
{
  "website_title": "string",
  "metatags": "string",
  "extracted_content": "string"
}`;
