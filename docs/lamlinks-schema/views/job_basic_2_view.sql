-- dbo.job_basic_2_view



/* view job_basic_2_view: add view */


/* view job_basic_2_view: add view */


/* view job_basic_2_view: add view */

/* view job_basic_2_view: add view */


/* view job_basic_2_view: add view */


/* view job_basic_2_view: add view */


/* view job_basic_2_view: add view */


/* view job_basic_2_view: add view */


/* view job_basic_2_view: add view */


/* view job_basic_2_view: add view */
/* view job_basic_2_view: add view 
 view job_basic_2_view: add view 
 view job_basic_2_view: add view 
 view job_basic_2_view: add view 
 view job_basic_2_view: add view 
 view job_basic_2_view: add view 
 view job_basic_2_view: add view 
 view job_basic_2_view: add view */
CREATE VIEW [dbo].[job_basic_2_view]
AS
SELECT        dbo.job_basic_1_view.job_no_ka8, dbo.job_basic_1_view.jln_no_ka9, dbo.job_basic_1_view.jlndte_ka9, dbo.job_basic_1_view.jrqpur_ka9, dbo.job_basic_1_view.jlnqty_ka9, dbo.job_basic_1_view.jlnsta_ka9, 
                         dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.clinno_k81, dbo.clin_basic_1_view.cage_k13, dbo.clin_basic_1_view.prtnum_k71, 
                         dbo.clin_basic_1_view.p_desc_k71, dbo.clin_basic_1_view.fsc_k08, dbo.clin_basic_1_view.niin_k08, dbo.clin_basic_1_view.idnk08_k08, dbo.clin_basic_1_view.idnk81_k81, dbo.job_basic_1_view.idnka9_ka9, 
                         dbo.clin_basic_1_view.idnk71_k71, dbo.clin_basic_1_view.piidno_k80
FROM            dbo.job_basic_1_view LEFT OUTER JOIN
                         dbo.clin_basic_1_view ON dbo.job_basic_1_view.idnk81_k81 = dbo.clin_basic_1_view.idnk81_k81










