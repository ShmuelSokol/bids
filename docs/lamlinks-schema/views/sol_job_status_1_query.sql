-- dbo.sol_job_status_1_query



/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */

/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */


/* view sol_job_status_1_query: add view */
CREATE VIEW [dbo].[sol_job_status_1_query]
AS
SELECT     dbo.k27_tab.ssatyp_k27, dbo.k28_tab.jobstt_k28, dbo.k28_tab.idnsrq_k28, dbo.k23_tab.sacnam_k23
FROM         dbo.k27_tab INNER JOIN
                      dbo.k28_tab ON dbo.k27_tab.idnk27_k27 = dbo.k28_tab.idnk27_k28 INNER JOIN
                      dbo.k23_tab ON dbo.k27_tab.idnk23_k27 = dbo.k23_tab.idnk23_k23
WHERE     (dbo.k28_tab.srqtyp_k28 = 'k11')


















