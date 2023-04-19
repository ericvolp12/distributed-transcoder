import JobList from "../components/JobList/JobList";

const IndexPage = () => {
  return (
    <div className="py-10">
      <main>
        <div className="mx-auto max-w-screen-2xl sm:px-6 lg:px-8">
          <JobList></JobList>
        </div>
      </main>
    </div>
  );
};

export default IndexPage;
