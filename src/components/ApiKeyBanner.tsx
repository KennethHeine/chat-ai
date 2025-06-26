import { AlertTriangle } from 'lucide-react';

interface ApiKeyBannerProps {
  onApiKeySet: (key: string) => void;
}

export const ApiKeyBanner = ({ onApiKeySet }: ApiKeyBannerProps) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const apiKey = formData.get('apiKey') as string;
    if (apiKey.trim()) {
      onApiKeySet(apiKey.trim());
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="text-yellow-800 font-medium mb-2">
            OpenAI API Key Required
          </h3>
          <p className="text-yellow-700 text-sm mb-3">
            Please enter your OpenAI API key to start chatting. Your key will be
            stored locally in your browser.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="password"
              name="apiKey"
              placeholder="sk-..."
              className="flex-1 px-3 py-2 border border-yellow-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              Set API Key
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
