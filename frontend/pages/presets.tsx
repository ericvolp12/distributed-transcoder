import PresetList from "../components/PresetList/PresetList";

const PresetPage = () => {
  return (
    <div className="py-10">
      <main>
        <div className="mx-auto max-w-screen-2xl sm:px-6 lg:px-8">
          <PresetList></PresetList>
        </div>
      </main>
    </div>
  );
};

export default PresetPage;
