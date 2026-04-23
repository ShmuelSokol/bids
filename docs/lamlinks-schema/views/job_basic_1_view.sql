-- dbo.job_basic_1_view



/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */

/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */


/* view job_basic_1_view: add view */
CREATE VIEW [dbo].[job_basic_1_view]
AS
SELECT     dbo.ka8_tab.job_no_ka8, dbo.ka9_tab.jln_no_ka9, dbo.ka9_tab.jlndte_ka9, dbo.ka9_tab.jrqpur_ka9, dbo.ka9_tab.jlnqty_ka9, dbo.ka9_tab.jlnsta_ka9, 
                      dbo.ka9_tab.jlnsdt_ka9, dbo.ka8_tab.idnka8_ka8, dbo.ka9_tab.idnka9_ka9, dbo.ka9_tab.idnk81_ka9 AS idnk81_k81, dbo.ka9_tab.idnkaj_ka9 AS idnkaj_kaj
FROM         dbo.ka8_tab INNER JOIN
                      dbo.ka9_tab ON dbo.ka8_tab.idnka8_ka8 = dbo.ka9_tab.idnka8_ka9


















