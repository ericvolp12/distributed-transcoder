const Spinner = () => {
  return (
    <div
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] text-secondary motion-reduce:animate-[spin_1.5s_linear_infinite]"
      role="status"
    >
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
        Loading...
      </span>
    </div>
  );
};

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  itemsOnThisPage: number;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  loading: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  itemsOnThisPage,
  handlePageChange,
  handlePageSizeChange,
  loading,
}) => {
  return (
    <div className="flex items-center justify-between border-t shadow ring-1 ring-black ring-opacity-5 border-gray-200 bg-gray-50 px-4 py-3 sm:px-6 sm:rounded-b-lg">
      <div className="flex flex-1 sm:block">
        <label
          htmlFor="page-size"
          className="mr-2 text-sm font-semibold text-gray-700"
        >
          Items per page:
        </label>
        <select
          id="page-size"
          value={pageSize}
          onChange={handlePageSizeChange}
          className="rounded-md border-gray-300 text-sm"
        >
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>
      <div className="flex flex-1 justify-center">
        <p className="text-sm text-gray-700">
          Page <span className="font-medium">{currentPage}</span>
        </p>
      </div>
      <div className="flex flex-1 justify-between sm:justify-end">
        {loading && (
          <div className="px-3 py-2 text-sm font-semibold">
            <Spinner />
          </div>
        )}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`relative mr-3 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-offset-0 ${
            currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Previous
        </button>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={itemsOnThisPage < pageSize}
          className={`relative ml-3 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-offset-0 ${
            itemsOnThisPage < pageSize ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};
