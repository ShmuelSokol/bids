-- dbo.cost_model_1_view



/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */

/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */


/* view cost_model_1_view: add view */
CREATE VIEW [dbo].[cost_model_1_view]
AS
SELECT     dbo.kck_tab.m_name_kck, dbo.kck_tab.m_titl_kck, dbo.kck_tab.m_desc_kck, dbo.kcj_tab.c_clas_kcj, dbo.kcj_tab.c_name_kcj, dbo.kcj_tab.cuname_kcj, 
                      dbo.kcj_tab.c_desc_kcj, dbo.kcm_tab.my_seq_kcm, dbo.kcm_tab.mypick_kcm, dbo.kcm_tab.my_unc_kcm, dbo.kcm_tab.myunit_kcm, dbo.kcm_tab.pcitem_kcm, 
                      dbo.kcm_tab.itotal_kcm, dbo.kcm_tab.my_xml_kcm, dbo.kck_tab.idnkck_kck, dbo.kcj_tab.idnkcj_kcj, dbo.kcm_tab.idnkcm_kcm
FROM         dbo.kck_tab INNER JOIN
                      dbo.kcm_tab ON dbo.kck_tab.idnkck_kck = dbo.kcm_tab.idnkck_kcm INNER JOIN
                      dbo.kcj_tab ON dbo.kcm_tab.idnkcj_kcm = dbo.kcj_tab.idnkcj_kcj


















