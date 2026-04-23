-- dbo.gduset_1_view



/* view gduset_1_view: add view */


/* view gduset_1_view: add view */


/* view gduset_1_view: add view */

/* view gduset_1_view: add view */


/* view gduset_1_view: add view */


/* view gduset_1_view: add view */


/* view gduset_1_view: add view */
/* view gduset_1_view: add view 
 view gduset_1_view: add view 
 view gduset_1_view: add view */
CREATE VIEW [dbo].[gduset_1_view]
AS
SELECT        dbo.ka7_tab.gduset_ka7, dbo.ka7_tab.frozen_ka7, dbo.ka6_tab.frozen_ka6, dbo.ka6_tab.gdutbl_ka6, dbo.ka6_tab.idngdu_ka6, dbo.ka7_tab.idnk12_ka7, dbo.ka6_tab.idnka6_ka6, dbo.ka6_tab.idnka7_ka6, 
                         dbo.ka7_tab.idnka7_ka7, dbo.ka7_tab.d_code_ka7, dbo.ka7_tab.d_name_ka7
FROM            dbo.ka6_tab INNER JOIN
                         dbo.ka7_tab ON dbo.ka6_tab.idnka7_ka6 = dbo.ka7_tab.idnka7_ka7







